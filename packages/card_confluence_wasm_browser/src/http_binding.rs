use std::{
    fmt,
    future::Future,
    ops::Range,
    pin::Pin,
    task::{Context, Poll},
};

use bytes::Bytes;
use futures::stream::{self, BoxStream};
use js_sys::Uint8Array;
use object_store::{
    path::Path, Error, GetOptions, GetRange, GetResult, GetResultPayload, ListResult,
    MultipartUpload, ObjectMeta, ObjectStore, PutMultipartOptions, PutOptions, PutPayload,
    PutResult, Result as StoreResult,
};
use url::Url;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
use web_sys::WorkerGlobalScope;

// ── SendWrapper ───────────────────────────────────────────────────────────────

/// Asserts `Send` on a `!Send` type.
///
/// # Safety
/// Only correct on single-threaded targets (i.e. WASM). The inner value is
/// never actually sent to another thread because there is no other thread.
struct SendWrapper<T>(T);

// SAFETY: WASM is single-threaded; nothing can be moved between threads.
unsafe impl<T> Send for SendWrapper<T> {}
unsafe impl<T> Sync for SendWrapper<T> {}

impl<F: Future> Future for SendWrapper<F> {
    type Output = F::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // SAFETY: We never move `F` out of the wrapper.
        unsafe { self.map_unchecked_mut(|s| &mut s.0) }.poll(cx)
    }
}

/// Boxes a `!Send + 'static` future behind a `Send + 'static` erased pointer.
fn send_future<F, T>(fut: F) -> Pin<Box<dyn Future<Output = T> + Send + 'static>>
where
    F: Future<Output = T> + 'static,
{
    Box::pin(SendWrapper(fut))
}

fn worker_fetch(req: &web_sys::Request) -> js_sys::Promise {
    let global: WorkerGlobalScope = js_sys::global().unchecked_into();
    global.fetch_with_request(req)
}

// ── PublicHTTPReadonlyStore ───────────────────────────────────────────────────

/// A read-only [`ObjectStore`] that fetches objects via web_sys `WorkerGlobalScope` fetch
/// from public HTTP / S3 / R2 endpoints.
pub struct PublicHTTPReadonlyStore {
    base_url: Url,
}

impl PublicHTTPReadonlyStore {
    pub fn new(base_url: Url) -> Self {
        Self { base_url }
    }

    pub fn base_url(&self) -> &Url {
        &self.base_url
    }

    fn url_for_path(&self, location: &Path) -> String {
        let mut url_str = self.base_url.as_str().to_string();
        if !url_str.ends_with('/') {
            url_str.push('/');
        }
        url_str.push_str(location.as_ref());
        url_str
    }
}

impl fmt::Display for PublicHTTPReadonlyStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "PublicHTTPReadonlyStore({})", self.base_url)
    }
}

impl fmt::Debug for PublicHTTPReadonlyStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("PublicHTTPReadonlyStore")
            .field("base_url", &self.base_url.as_str())
            .finish()
    }
}

fn parse_content_range(
    content_range: Option<&str>,
    req_range: Option<&GetRange>,
    fetched_len: u64,
) -> (Range<u64>, u64) {
    if let Some(header) = content_range {
        if let Some(spec) = header.strip_prefix("bytes ") {
            let parts: Vec<&str> = spec.split('/').collect();
            if parts.len() == 2 {
                let range_parts: Vec<&str> = parts[0].split('-').collect();
                if range_parts.len() == 2 {
                    if let (Ok(start), Ok(end)) =
                        (range_parts[0].parse::<u64>(), range_parts[1].parse::<u64>())
                    {
                        let total = parts[1].parse::<u64>().unwrap_or(end + 1);
                        return (start..end + 1, total);
                    }
                }
            }
        }
    }

    let start = match req_range {
        Some(GetRange::Bounded(r)) => r.start,
        Some(GetRange::Offset(off)) => *off,
        _ => 0,
    };
    let end = start + fetched_len;
    (start..end, end)
}

impl ObjectStore for PublicHTTPReadonlyStore {
    fn get_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
        options: GetOptions,
    ) -> Pin<Box<dyn Future<Output = StoreResult<GetResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        let url_str = self.url_for_path(location);
        let location = location.clone();

        send_future(async move {
            let headers = web_sys::Headers::new().map_err(|e| Error::Generic {
                store: "PublicHTTPReadonlyStore",
                source: format!("Failed to create Headers: {:?}", e).into(),
            })?;

            if let Some(range) = &options.range {
                let range_header = match range {
                    GetRange::Bounded(r) => {
                        if r.end > r.start {
                            format!("bytes={}-{}", r.start, r.end - 1)
                        } else {
                            format!("bytes={}-{}", r.start, r.start)
                        }
                    }
                    GetRange::Offset(offset) => format!("bytes={}-", offset),
                    GetRange::Suffix(suffix) => format!("bytes=-{}", suffix),
                };
                headers
                    .set("Range", &range_header)
                    .map_err(|e| Error::Generic {
                        store: "PublicHTTPReadonlyStore",
                        source: format!("Failed to set Range header: {:?}", e).into(),
                    })?;
            }

            if let Some(if_match) = &options.if_match {
                headers
                    .set("If-Match", if_match)
                    .map_err(|e| Error::Generic {
                        store: "PublicHTTPReadonlyStore",
                        source: format!("Failed to set If-Match header: {:?}", e).into(),
                    })?;
            }

            if let Some(if_none_match) = &options.if_none_match {
                headers
                    .set("If-None-Match", if_none_match)
                    .map_err(|e| Error::Generic {
                        store: "PublicHTTPReadonlyStore",
                        source: format!("Failed to set If-None-Match header: {:?}", e).into(),
                    })?;
            }

            let req_init = web_sys::RequestInit::new();
            req_init.set_method("GET");
            req_init.set_headers(&headers);

            let req =
                web_sys::Request::new_with_str_and_init(&url_str, &req_init).map_err(|e| {
                    Error::Generic {
                        store: "PublicHTTPReadonlyStore",
                        source: format!("Failed to create Request: {:?}", e).into(),
                    }
                })?;

            let promise = worker_fetch(&req);

            let js_val = JsFuture::from(promise).await.map_err(|e| Error::Generic {
                store: "PublicHTTPReadonlyStore",
                source: format!("fetch promise rejected: {:?}", e).into(),
            })?;

            let response: web_sys::Response = js_val.unchecked_into();
            let status = response.status();

            if status == 404 || status == 403 {
                return Err(Error::NotFound {
                    path: location.to_string(),
                    source: format!("HTTP {}", status).into(),
                });
            }

            if !response.ok() {
                return Err(Error::Generic {
                    store: "PublicHTTPReadonlyStore",
                    source: format!("HTTP GET failed with status {}", status).into(),
                });
            }

            let res_headers = response.headers();
            let e_tag = res_headers.get("etag").ok().flatten();
            let last_modified = res_headers
                .get("last-modified")
                .ok()
                .flatten()
                .and_then(|s| chrono::DateTime::parse_from_rfc2822(&s).ok())
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(chrono::Utc::now);

            let buf_promise = response.array_buffer().map_err(|e| Error::Generic {
                store: "PublicHTTPReadonlyStore",
                source: format!("arrayBuffer() call failed: {:?}", e).into(),
            })?;

            let buf_val = JsFuture::from(buf_promise)
                .await
                .map_err(|e| Error::Generic {
                    store: "PublicHTTPReadonlyStore",
                    source: format!("arrayBuffer() promise rejected: {:?}", e).into(),
                })?;

            let uint8_arr = Uint8Array::new(&buf_val);
            let bytes = Bytes::from(uint8_arr.to_vec());

            let content_range = res_headers.get("content-range").ok().flatten();
            let (byte_range, total_size) = parse_content_range(
                content_range.as_deref(),
                options.range.as_ref(),
                bytes.len() as u64,
            );

            let meta = ObjectMeta {
                location,
                last_modified,
                size: total_size,
                e_tag,
                version: None,
            };

            Ok(GetResult {
                payload: GetResultPayload::Stream(Box::pin(stream::once(async move { Ok(bytes) }))),
                meta,
                range: byte_range,
                attributes: Default::default(),
            })
        })
    }

    fn head<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
    ) -> Pin<Box<dyn Future<Output = StoreResult<ObjectMeta>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        let url_str = self.url_for_path(location);
        let location = location.clone();

        send_future(async move {
            let req_init = web_sys::RequestInit::new();
            req_init.set_method("HEAD");

            let req =
                web_sys::Request::new_with_str_and_init(&url_str, &req_init).map_err(|e| {
                    Error::Generic {
                        store: "PublicHTTPReadonlyStore",
                        source: format!("Failed to create HEAD Request: {:?}", e).into(),
                    }
                })?;

            let promise = worker_fetch(&req);

            let js_val = JsFuture::from(promise).await.map_err(|e| Error::Generic {
                store: "PublicHTTPReadonlyStore",
                source: format!("HEAD fetch promise rejected: {:?}", e).into(),
            })?;

            let response: web_sys::Response = js_val.unchecked_into();
            let status = response.status();

            if status == 404 || status == 403 {
                return Err(Error::NotFound {
                    path: location.to_string(),
                    source: format!("HTTP {}", status).into(),
                });
            }

            if !response.ok() {
                return Err(Error::Generic {
                    store: "PublicHTTPReadonlyStore",
                    source: format!("HTTP HEAD failed with status {}", status).into(),
                });
            }

            let res_headers = response.headers();
            let size = res_headers
                .get("content-length")
                .ok()
                .flatten()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            let e_tag = res_headers.get("etag").ok().flatten();
            let last_modified = res_headers
                .get("last-modified")
                .ok()
                .flatten()
                .and_then(|s| chrono::DateTime::parse_from_rfc2822(&s).ok())
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(chrono::Utc::now);

            Ok(ObjectMeta {
                location,
                last_modified,
                size,
                e_tag,
                version: None,
            })
        })
    }

    fn list(&self, _prefix: Option<&Path>) -> BoxStream<'static, StoreResult<ObjectMeta>> {
        // TODO: Implement List
        Box::pin(stream::empty())
    }

    fn list_with_offset(
        &self,
        _prefix: Option<&Path>,
        _offset: &Path,
    ) -> BoxStream<'static, StoreResult<ObjectMeta>> {
        // TODO: Implement List
        Box::pin(stream::empty())
    }

    fn put_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
        _payload: PutPayload,
        _opts: PutOptions,
    ) -> Pin<Box<dyn Future<Output = StoreResult<PutResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }

    fn put_multipart_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
        _opts: PutMultipartOptions,
    ) -> Pin<Box<dyn Future<Output = StoreResult<Box<dyn MultipartUpload>>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }

    fn delete<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
    ) -> Pin<Box<dyn Future<Output = StoreResult<()>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }

    fn list_with_delimiter<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _prefix: Option<&'life1 Path>,
    ) -> Pin<Box<dyn Future<Output = StoreResult<ListResult>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }

    fn copy<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        _from: &'life1 Path,
        _to: &'life2 Path,
    ) -> Pin<Box<dyn Future<Output = StoreResult<()>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }

    fn copy_if_not_exists<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        _from: &'life1 Path,
        _to: &'life2 Path,
    ) -> Pin<Box<dyn Future<Output = StoreResult<()>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }
}
