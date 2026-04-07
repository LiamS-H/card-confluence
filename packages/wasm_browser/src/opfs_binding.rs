use std::{
    collections::HashMap,
    fmt,
    future::Future,
    ops::Range,
    pin::Pin,
    task::{Context, Poll},
};

use bytes::Bytes;
use futures::{
    stream::{self, BoxStream, StreamExt},
    TryStreamExt,
};
use js_sys::{ArrayBuffer, Uint8Array};
use object_store::{
    path::Path, Error, GetOptions, GetResult, GetResultPayload, ListResult, MultipartUpload,
    ObjectMeta, ObjectStore, PutMultipartOptions, PutOptions, PutPayload, PutResult, Result,
};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
use web_sys::FileSystemFileHandle;

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

// ── OpfsReadonlyStore ─────────────────────────────────────────────────────────

/// A read-only [`ObjectStore`] that serves files from the browser's OPFS.
pub struct OpfsReadonlyStore {
    /// `FileSystemFileHandle` is `!Send`, which is fine — we only ever access
    /// this map on the one WASM thread, and `SendWrapper` silences the
    /// compiler.
    files: HashMap<Path, SendWrapper<FileSystemFileHandle>>,
}

impl OpfsReadonlyStore {
    /// Creates an empty store with no registered files.
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
        }
    }

    /// Registers an OPFS file handle under the given logical `path`.
    ///
    /// The handle must already exist in OPFS (i.e. obtained without
    /// `{ create: true }`). Registering the same path twice overwrites the
    /// previous handle.
    pub fn register_file(&mut self, path: Path, handle: FileSystemFileHandle) {
        self.files.insert(path, SendWrapper(handle));
    }

    /// Returns the set of all currently registered paths.
    pub fn registered_paths(&self) -> impl Iterator<Item = &Path> {
        self.files.keys()
    }

    fn not_found(&self, path: &Path) -> Error {
        Error::NotFound {
            path: path.to_string(),
            source: "path not registered in OpfsReadonlyStore".into(),
        }
    }

    async fn read_file_bytes_range(
        handle: &FileSystemFileHandle,
        range: Option<&object_store::GetRange>,
        total_size: u64,
    ) -> Result<(Bytes, Range<u64>)> {
        let file_val = JsFuture::from(handle.get_file())
            .await
            .map_err(|e| Error::Generic {
                store: "OpfsReadonlyStore",
                source: format!("getFile() failed: {:?}", e).into(),
            })?;
        let file: web_sys::File = file_val.dyn_into().map_err(|_| Error::Generic {
            store: "OpfsReadonlyStore",
            source: "getFile() did not return a File".into(),
        })?;

        let byte_range = Self::resolve_range(range, total_size);

        let blob = file
            .slice_with_f64_and_f64(byte_range.start as f64, byte_range.end as f64)
            .map_err(|e| Error::Generic {
                store: "OpfsReadonlyStore",
                source: format!("Blob.slice() failed: {:?}", e).into(),
            })?;

        let buf_val = JsFuture::from(blob.array_buffer())
            .await
            .map_err(|e| Error::Generic {
                store: "OpfsReadonlyStore",
                source: format!("arrayBuffer() failed: {:?}", e).into(),
            })?;
        let array_buf: ArrayBuffer = buf_val.dyn_into().map_err(|_| Error::Generic {
            store: "OpfsReadonlyStore",
            source: "arrayBuffer() did not return an ArrayBuffer".into(),
        })?;

        let uint8 = Uint8Array::new(&array_buf);
        Ok((Bytes::from(uint8.to_vec()), byte_range))
    }

    /// Resolves a [`GetRange`] to a concrete [`Range<u64>`] given the file's
    /// `total` byte length.
    fn resolve_range(range: Option<&object_store::GetRange>, total: u64) -> Range<u64> {
        match range {
            None => 0..total,
            Some(object_store::GetRange::Bounded(r)) => r.start.min(total)..r.end.min(total),
            Some(object_store::GetRange::Offset(off)) => (*off).min(total)..total,
            Some(object_store::GetRange::Suffix(n)) => total.saturating_sub(*n)..total,
        }
    }

    /// Builds an [`ObjectMeta`] for a registered path using the file's own
    /// reported size and last-modified timestamp.
    async fn file_meta(path: Path, handle: &FileSystemFileHandle) -> Result<ObjectMeta> {
        let file_val = JsFuture::from(handle.get_file())
            .await
            .map_err(|e| Error::Generic {
                store: "OpfsReadonlyStore",
                source: format!("getFile() failed: {:?}", e).into(),
            })?;
        let file: web_sys::File = file_val.dyn_into().map_err(|_| Error::Generic {
            store: "OpfsReadonlyStore",
            source: "getFile() did not return a File".into(),
        })?;

        let size = file.size() as u64;
        let last_modified_ms = file.last_modified();
        let last_modified = chrono::DateTime::from_timestamp_millis(last_modified_ms as i64)
            .unwrap_or_else(chrono::Utc::now);

        Ok(ObjectMeta {
            location: path,
            last_modified,
            size,
            e_tag: None,
            version: None,
        })
    }
}

impl Default for OpfsReadonlyStore {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for OpfsReadonlyStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "OpfsReadonlyStore({} files)", self.files.len())
    }
}

impl fmt::Debug for OpfsReadonlyStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OpfsReadonlyStore")
            .field("files", &self.files.keys().collect::<Vec<_>>())
            .finish()
    }
}

impl ObjectStore for OpfsReadonlyStore {
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
        let result = self
            .files
            .get(location)
            .ok_or_else(|| self.not_found(location));

        let location = location.clone();

        match result {
            Err(e) => Box::pin(async move { Err(e) }),
            Ok(handle) => {
                let handle_ptr = &handle.0 as *const FileSystemFileHandle;

                send_future(async move {
                    let handle = unsafe { &*handle_ptr };

                    let meta = Self::file_meta(location.clone(), handle).await?;
                    let total = meta.size;

                    let (sliced, byte_range) =
                        Self::read_file_bytes_range(handle, options.range.as_ref(), total).await?;

                    Ok(GetResult {
                        payload: GetResultPayload::Stream(Box::pin(stream::once(async move {
                            Ok(sliced)
                        }))),
                        meta,
                        range: byte_range,
                        attributes: Default::default(),
                    })
                })
            }
        }
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
        let result = self
            .files
            .get(location)
            .ok_or_else(|| self.not_found(location));

        let location = location.clone();

        match result {
            Err(e) => Box::pin(async move { Err(e) }),
            Ok(handle) => {
                let handle_ptr = &handle.0 as *const FileSystemFileHandle;
                send_future(async move {
                    let handle = unsafe { &*handle_ptr };
                    Self::file_meta(location, handle).await
                })
            }
        }
    }

    fn list(&self, prefix: Option<&Path>) -> BoxStream<'static, Result<ObjectMeta>> {
        // Wrap the raw pointer in SendWrapper so the vector items are Send (just to make compiler happy)
        let entries: Vec<(Path, SendWrapper<*const FileSystemFileHandle>)> = self
            .files
            .iter()
            .filter(|(p, _)| match &prefix {
                None => true,
                Some(pfx) => p.as_ref().starts_with(pfx.as_ref()),
            })
            // Wrap the pointer here
            .map(|(p, h)| (p.clone(), SendWrapper(&h.0 as *const FileSystemFileHandle)))
            .collect();

        let stream = stream::iter(entries).then(|(path, ptr)| {
            send_future(async move {
                // Unwrap it inside the future
                let handle = unsafe { &*ptr.0 };
                Self::file_meta(path, handle).await
            })
        });

        Box::pin(stream)
    }

    fn list_with_offset(
        &self,
        prefix: Option<&Path>,
        offset: &Path,
    ) -> BoxStream<'static, Result<ObjectMeta>> {
        let offset = offset.clone();
        let base = self.list(prefix);
        Box::pin(base.try_filter(move |meta| std::future::ready(meta.location > offset)))
    }

    fn put_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
        _payload: PutPayload,
        _opts: PutOptions,
    ) -> Pin<Box<dyn Future<Output = Result<PutResult>> + Send + 'async_trait>>
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
    ) -> Pin<Box<dyn Future<Output = Result<Box<dyn MultipartUpload>>> + Send + 'async_trait>>
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
    ) -> ::core::pin::Pin<
        Box<dyn ::core::future::Future<Output = Result<()>> + ::core::marker::Send + 'async_trait>,
    >
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
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = Result<ListResult>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
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
    ) -> ::core::pin::Pin<
        Box<dyn ::core::future::Future<Output = Result<()>> + ::core::marker::Send + 'async_trait>,
    >
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
    ) -> ::core::pin::Pin<
        Box<dyn ::core::future::Future<Output = Result<()>> + ::core::marker::Send + 'async_trait>,
    >
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move { Err(Error::NotImplemented) })
    }
}
