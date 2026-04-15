use std::{
    fmt,
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

use bytes::Bytes;
use futures::stream::{self, BoxStream, TryStreamExt};
use object_store::{
    path::Path, Error, GetOptions, GetResult, GetResultPayload, ListResult, MultipartUpload,
    ObjectMeta, ObjectStore, PutMultipartOptions, PutOptions, PutPayload, PutResult, Result,
};
use worker::Range as R2Range;
use worker::{Bucket, Data};

// ── SendWrapper ───────────────────────────────────────────────────────────────

struct SendWrapper<T>(T);

// SAFETY: WASM Workers runtime is single-threaded
unsafe impl<T> Send for SendWrapper<T> {}
unsafe impl<T> Sync for SendWrapper<T> {}

impl<F: Future> Future for SendWrapper<F> {
    type Output = F::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        unsafe { self.map_unchecked_mut(|s| &mut s.0) }.poll(cx)
    }
}

fn send_future<F, T>(fut: F) -> Pin<Box<dyn Future<Output = T> + Send + 'static>>
where
    F: Future<Output = T> + 'static,
{
    Box::pin(SendWrapper(fut))
}

// ── R2WorkerStore ─────────────────────────────────────────────────────────────

pub struct R2WorkerStore {
    bucket: Bucket,
}

impl R2WorkerStore {
    pub fn new(bucket: Bucket) -> Self {
        Self { bucket }
    }

    fn err(e: impl std::fmt::Debug) -> Error {
        Error::Generic {
            store: "R2WorkerStore",
            source: format!("{:?}", e).into(),
        }
    }

    fn not_found(path: &Path) -> Error {
        Error::NotFound {
            path: path.to_string(),
            source: "not found in R2".into(),
        }
    }
}

impl fmt::Debug for R2WorkerStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("R2WorkerStore")
    }
}

impl fmt::Display for R2WorkerStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("R2WorkerStore")
    }
}

// ── ObjectStore impl ──────────────────────────────────────────────────────────

impl ObjectStore for R2WorkerStore {
    fn get_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
        options: GetOptions,
    ) -> Pin<Box<dyn Future<Output = Result<GetResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        let key = location.to_string();
        let bucket = self.bucket.clone();

        send_future(async move {
            let mut req = bucket.get(&key);

            if let Some(range) = options.range {
                let r2_range = match range {
                    object_store::GetRange::Bounded(r) => R2Range::OffsetWithLength {
                        offset: r.start,
                        length: r.end - r.start,
                    },
                    object_store::GetRange::Offset(offset) => R2Range::OffsetToEnd { offset },
                    object_store::GetRange::Suffix(suffix) => R2Range::Suffix { suffix },
                };

                req = req.range(r2_range);
            }

            let obj = req
                .execute()
                .await
                .map_err(Self::err)?
                .ok_or_else(|| Self::not_found(&Path::from(key.clone())))?;

            let size = obj.size() as u64;
            let body = obj
                .body()
                .ok_or(Self::err("Failed to access object body."))?;

            let bytes = body.bytes().await.map_err(Self::err)?;

            let meta = ObjectMeta {
                location: Path::from(key),
                last_modified: chrono::Utc::now(),
                size,
                e_tag: None,
                version: None,
            };

            Ok(GetResult {
                payload: GetResultPayload::Stream(Box::pin(stream::once(async move {
                    Ok(Bytes::from(bytes))
                }))),
                meta,
                range: 0..size,
                attributes: Default::default(),
            })
        })
    }

    fn head<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
    ) -> Pin<Box<dyn Future<Output = Result<ObjectMeta>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        let key = location.to_string();
        let bucket = self.bucket.clone();

        send_future(async move {
            let obj = bucket
                .head(&key)
                .await
                .map_err(Self::err)?
                .ok_or_else(|| Self::not_found(&Path::from(key.clone())))?;

            Ok(ObjectMeta {
                location: Path::from(key),
                last_modified: chrono::Utc::now(),
                size: obj.size() as u64,
                e_tag: None,
                version: None,
            })
        })
    }

    fn list(&self, prefix: Option<&Path>) -> BoxStream<'static, Result<ObjectMeta>> {
        let bucket = self.bucket.clone();
        let prefix = prefix.map(|p| p.to_string());

        Box::pin(
            stream::once::<
                Pin<
                    Box<
                        dyn futures::Future<
                                Output = Result<
                                    futures::stream::Iter<
                                        std::vec::IntoIter<Result<ObjectMeta, object_store::Error>>,
                                    >,
                                    Error,
                                >,
                            > + std::marker::Send,
                    >,
                >,
            >(send_future(async move {
                let mut cursor: Option<String> = None;
                let mut out = Vec::new();

                loop {
                    let mut req = bucket.list();

                    if let Some(ref p) = prefix {
                        req = req.prefix(p);
                    }

                    if let Some(ref c) = cursor {
                        req = req.cursor(c);
                    }

                    let page = req.execute().await.map_err(Self::err)?;

                    for obj in page.objects() {
                        out.push(Ok(ObjectMeta {
                            location: Path::from(obj.key()),
                            last_modified: chrono::Utc::now(),
                            size: obj.size(),
                            e_tag: None,
                            version: None,
                        }));
                    }

                    match page.cursor() {
                        Some(next) => cursor = Some(next),
                        None => break,
                    }
                }

                Ok(stream::iter(out))
            }))
            .try_flatten(),
        )
    }

    fn list_with_offset(
        &self,
        prefix: Option<&Path>,
        offset: &Path,
    ) -> BoxStream<'static, Result<ObjectMeta>> {
        let offset = offset.clone();
        Box::pin(
            self.list(prefix)
                .try_filter(move |meta| std::future::ready(meta.location > offset)),
        )
    }

    fn put_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
        payload: PutPayload,
        _opts: PutOptions,
    ) -> Pin<Box<dyn Future<Output = Result<PutResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        let key = location.to_string();
        let bucket = self.bucket.clone();

        send_future(async move {
            let bytes = payload.as_ref().concat();

            bucket
                .put(&key, Data::Bytes(bytes.into()))
                .execute()
                .await
                .map_err(Self::err)?;

            Ok(PutResult {
                e_tag: Some(key.clone()),
                version: None,
            })
        })
    }

    fn delete<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        let key = location.to_string();
        let bucket = self.bucket.clone();

        send_future(async move {
            bucket.delete(&key).await.map_err(Self::err)?;
            Ok(())
        })
    }

    // ── Not implemented ───────────────────────────────────────────────────────

    fn put_multipart_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
        _opts: PutMultipartOptions,
    ) -> Pin<Box<dyn Future<Output = Result<Box<dyn MultipartUpload>>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        Box::pin(async { Err(Error::NotImplemented) })
    }

    fn list_with_delimiter<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _prefix: Option<&'life1 Path>,
    ) -> Pin<Box<dyn Future<Output = Result<ListResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        Box::pin(async { Err(Error::NotImplemented) })
    }

    fn copy<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        _from: &'life1 Path,
        _to: &'life2 Path,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
    {
        Box::pin(async { Err(Error::NotImplemented) })
    }

    fn copy_if_not_exists<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        _from: &'life1 Path,
        _to: &'life2 Path,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
    {
        Box::pin(async { Err(Error::NotImplemented) })
    }
}
