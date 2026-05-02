use std::{
    cell::RefCell,
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
use js_sys::Uint8Array;
use object_store::{
    path::Path, Error, GetOptions, GetResult, GetResultPayload, ListResult, MultipartUpload,
    ObjectMeta, ObjectStore, PutMultipartOptions, PutOptions, PutPayload, PutResult, Result,
};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{FileSystemFileHandle, FileSystemReadWriteOptions, FileSystemSyncAccessHandle};

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
    files: SendWrapper<RefCell<HashMap<Path, FileSystemSyncAccessHandle>>>,
}

impl OpfsReadonlyStore {
    /// Creates an empty store with no registered files.
    pub fn new() -> Self {
        Self {
            files: SendWrapper(RefCell::new(HashMap::new())),
        }
    }

    /// Registers an OPFS file handle under the given logical `path`.
    ///
    /// The handle must already exist in OPFS (i.e. obtained without
    /// `{ create: true }`). Registering the same path twice overwrites the
    /// previous handle.
    pub async fn register_file(
        &self,
        path: Path,
        handle: FileSystemFileHandle,
    ) -> Result<(), JsValue> {
        let promise = handle.create_sync_access_handle();
        let js_val = JsFuture::from(promise).await?;
        let sync_handle: FileSystemSyncAccessHandle = js_val.unchecked_into();

        self.files.0.borrow_mut().insert(path, sync_handle);

        Ok(())
    }

    pub fn release_file(&self, path: Path) -> Result<(), JsValue> {
        if let Some(handle) = self.files.0.borrow_mut().remove(&path) {
            handle.close();
            Ok(())
        } else {
            Err(JsValue::from("Failed to release file. File not found."))
        }
    }

    /// Returns the set of all currently registered paths.
    pub fn registered_paths(&self) -> Vec<Path> {
        self.files.0.borrow().keys().cloned().collect()
    }

    fn not_found(&self, path: &Path) -> Error {
        Error::NotFound {
            path: path.to_string(),
            source: "path not registered in OpfsReadonlyStore".into(),
        }
    }

    fn read_file_bytes_range(
        handle: &FileSystemSyncAccessHandle,
        range: Option<&object_store::GetRange>,
    ) -> Result<(Bytes, Range<u64>)> {
        // 1. Get the current size synchronously
        let total_size = handle.get_size().map_err(|e| Error::Generic {
            store: "OpfsReadonlyStore",
            source: format!("getSize() failed: {:?}", e).into(),
        })? as u64;

        let byte_range = Self::resolve_range(range, total_size);
        let len = byte_range.end - byte_range.start;

        // 2. Prepare the buffer and options
        let buffer = Uint8Array::new_with_length(len as u32);
        let options = FileSystemReadWriteOptions::new();
        options.set_at(byte_range.start as f64);

        // 3. Perform the synchronous read
        handle
            .read_with_buffer_source_and_options(&buffer, &options)
            .map_err(|e| Error::Generic {
                store: "OpfsReadonlyStore",
                source: format!("Sync read failed: {:?}", e).into(),
            })?;

        Ok((Bytes::from(buffer.to_vec()), byte_range))
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
    fn file_meta(path: Path, handle: &FileSystemSyncAccessHandle) -> Result<ObjectMeta> {
        let size = handle.get_size().map_err(|e| Error::Generic {
            store: "OpfsReadonlyStore",
            source: format!("getSize() failed: {:?}", e).into(),
        })? as u64;

        // Note: SyncAccessHandle lacks a last_modified method.
        // You may need to pass this in from a previous async getFile() call.
        let last_modified = chrono::Utc::now();

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
        write!(
            f,
            "OpfsReadonlyStore({} files)",
            self.files.0.borrow().len()
        )
    }
}

impl fmt::Debug for OpfsReadonlyStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OpfsReadonlyStore")
            .field("files", &self.files.0.borrow().keys().collect::<Vec<_>>())
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
        // Scope the borrow so it doesn't cross the await point or future creation
        let handle_ptr_res = {
            let map = self.files.0.borrow();
            map.get(location)
                .map(|h| h as *const FileSystemSyncAccessHandle)
                .ok_or_else(|| self.not_found(location))
        };

        let location = location.clone();

        match handle_ptr_res {
            Err(e) => Box::pin(async move { Err(e) }),
            Ok(handle_ptr) => send_future(async move {
                let handle = unsafe { &*handle_ptr };

                let meta = Self::file_meta(location.clone(), handle)?;

                let (sliced, byte_range) =
                    Self::read_file_bytes_range(handle, options.range.as_ref())?;

                Ok(GetResult {
                    payload: GetResultPayload::Stream(Box::pin(stream::once(
                        async move { Ok(sliced) },
                    ))),
                    meta,
                    range: byte_range,
                    attributes: Default::default(),
                })
            }),
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
        let handle_ptr_res = {
            let map = self.files.0.borrow();
            map.get(location)
                .map(|h| h as *const FileSystemSyncAccessHandle)
                .ok_or_else(|| self.not_found(location))
        };

        let location = location.clone();

        match handle_ptr_res {
            Err(e) => Box::pin(async move { Err(e) }),
            Ok(handle_ptr) => send_future(async move {
                let handle = unsafe { &*handle_ptr };
                Self::file_meta(location, handle)
            }),
        }
    }

    fn list(&self, prefix: Option<&Path>) -> BoxStream<'static, Result<ObjectMeta>> {
        // Collect pointers to safely yield items outside the RefCell borrow scope
        let entries: Vec<(Path, SendWrapper<*const FileSystemSyncAccessHandle>)> = {
            let map = self.files.0.borrow();
            map.iter()
                .filter(|(p, _)| match &prefix {
                    None => true,
                    Some(pfx) => p.as_ref().starts_with(pfx.as_ref()),
                })
                .map(|(p, h)| {
                    (
                        p.clone(),
                        SendWrapper(h as *const FileSystemSyncAccessHandle),
                    )
                })
                .collect()
        };

        let stream = stream::iter(entries).then(|(path, ptr)| {
            send_future(async move {
                let handle = unsafe { &*ptr.0 };
                Self::file_meta(path, handle)
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
