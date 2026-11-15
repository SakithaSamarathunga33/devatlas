//! Use case: covers for shared collections. Small copies of the first links' preview images,
//! made by the owner's app when sharing and kept on the community server, so viewers see what
//! a collection holds without ever contacting the linked sites.

use std::future::Future;

use url::Url;

use crate::community::{CommunityInputError, MAX_COVERS, check_id};
use crate::preview::{self, PreviewCache, PreviewSource};

/// Links tried for covers, so sharing a long collection never waits on dozens of sites.
const MAX_TRIED: usize = 6;

/// Port: a small, re-encoded JPEG copy of a web image.
pub trait CoverMaker {
    type Error: std::error::Error;

    fn cover(&self, image: &Url) -> impl Future<Output = Result<Vec<u8>, Self::Error>> + Send;
}

/// Port: where a shared collection's covers are kept; only its owner may change them.
pub trait CoverStore {
    type Error: std::error::Error;

    fn put_cover(
        &self,
        collection: &str,
        index: usize,
        jpeg: &[u8],
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Records how many covers there are, which is what cards show.
    fn set_covers(
        &self,
        collection: &str,
        count: usize,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Deletes covers `from` onwards; 0 deletes them all.
    fn delete_covers(
        &self,
        collection: &str,
        from: usize,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum CoverError<E: std::error::Error> {
    #[error(transparent)]
    Invalid(#[from] CommunityInputError),
    #[error(transparent)]
    Store(E),
}

/// Makes covers from the first links with a preview image, in order, and stores them.
/// Links whose image can't be read or stored are skipped, and covers left over from an earlier
/// share are deleted, so a removed link's image doesn't stay public. Returns the new count.
pub async fn refresh_covers<P, C, M, S>(
    previews: &P,
    cache: &C,
    maker: &M,
    store: &S,
    collection: &str,
    links: &[String],
) -> Result<usize, CoverError<S::Error>>
where
    P: PreviewSource,
    C: PreviewCache,
    M: CoverMaker,
    S: CoverStore,
{
    let collection = check_id(collection)?.to_ascii_lowercase();
    let mut count = 0;
    for link in links.iter().take(MAX_TRIED) {
        if count == MAX_COVERS {
            break;
        }
        let Ok(found) = preview::get_preview(previews, cache, link).await else {
            continue;
        };
        let Some(image) = found.image.and_then(|image| Url::parse(&image).ok()) else {
            continue;
        };
        let Ok(jpeg) = maker.cover(&image).await else {
            continue;
        };
        if store.put_cover(&collection, count, &jpeg).await.is_ok() {
            count += 1;
        }
    }
    store
        .set_covers(&collection, count)
        .await
        .map_err(CoverError::Store)?;
    if count < MAX_COVERS {
        store
            .delete_covers(&collection, count)
            .await
            .map_err(CoverError::Store)?;
    }
    Ok(count)
}

/// Removes a collection's covers; call before unsharing it, while it is still the caller's.
/// The count goes first, so a card never points at deleted files.
pub async fn remove_covers<S: CoverStore>(
    store: &S,
    collection: &str,
) -> Result<(), CoverError<S::Error>> {
    let collection = check_id(collection)?.to_ascii_lowercase();
    store
        .set_covers(&collection, 0)
        .await
        .map_err(CoverError::Store)?;
    store
        .delete_covers(&collection, 0)
        .await
        .map_err(CoverError::Store)
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;
    use crate::preview::ResourcePreview;

    const ID: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";

    #[derive(Debug, thiserror::Error)]
    #[error("unavailable")]
    struct Unavailable;

    /// Pages under `https://img.dev/` have an image named after their path; others have none.
    struct Pages;

    impl PreviewSource for Pages {
        type Error = Unavailable;

        async fn fetch(&self, url: &Url) -> Result<ResourcePreview, Unavailable> {
            let image = (url.host_str() == Some("img.dev"))
                .then(|| format!("https://cdn.dev{}.png", url.path()));
            Ok(ResourcePreview {
                image,
                ..ResourcePreview::default()
            })
        }
    }

    struct NoCache;

    impl PreviewCache for NoCache {
        fn get(&self, _: &str) -> Option<ResourcePreview> {
            None
        }
        fn put(&self, _: &str, _: ResourcePreview) {}
    }

    /// Fails for images named `broken`.
    struct Maker;

    impl CoverMaker for Maker {
        type Error = Unavailable;

        async fn cover(&self, image: &Url) -> Result<Vec<u8>, Unavailable> {
            if image.path().contains("broken") {
                return Err(Unavailable);
            }
            Ok(image.path().as_bytes().to_vec())
        }
    }

    #[derive(Default)]
    struct Store {
        puts: Mutex<Vec<(String, usize, Vec<u8>)>>,
        count: Mutex<Option<usize>>,
        deleted_from: Mutex<Option<usize>>,
    }

    impl CoverStore for Store {
        type Error = Unavailable;

        async fn put_cover(&self, id: &str, index: usize, jpeg: &[u8]) -> Result<(), Unavailable> {
            self.puts
                .lock()
                .unwrap()
                .push((id.to_owned(), index, jpeg.to_vec()));
            Ok(())
        }
        async fn set_covers(&self, _: &str, count: usize) -> Result<(), Unavailable> {
            *self.count.lock().unwrap() = Some(count);
            Ok(())
        }
        async fn delete_covers(&self, _: &str, from: usize) -> Result<(), Unavailable> {
            *self.deleted_from.lock().unwrap() = Some(from);
            Ok(())
        }
    }

    fn block_on<F: Future>(future: F) -> F::Output {
        let waker = std::task::Waker::noop();
        let mut context = std::task::Context::from_waker(waker);
        let mut future = std::pin::pin!(future);
        loop {
            if let std::task::Poll::Ready(output) = future.as_mut().poll(&mut context) {
                return output;
            }
        }
    }

    #[test]
    fn covers_the_first_three_links_that_have_a_readable_image() {
        let links: Vec<String> = [
            "https://plain.dev/",
            "https://img.dev/a",
            "https://img.dev/broken",
            "https://img.dev/b",
            "https://img.dev/c",
            "https://img.dev/d",
        ]
        .map(String::from)
        .to_vec();
        let store = Store::default();

        let count = block_on(refresh_covers(&Pages, &NoCache, &Maker, &store, ID, &links)).unwrap();

        assert_eq!(count, 3);
        assert_eq!(*store.count.lock().unwrap(), Some(3));
        let puts = store.puts.lock().unwrap();
        let made: Vec<(usize, &[u8])> = puts.iter().map(|(_, i, b)| (*i, b.as_slice())).collect();
        assert_eq!(
            made,
            [
                (0, &b"/a.png"[..]),
                (1, &b"/b.png"[..]),
                (2, &b"/c.png"[..])
            ]
        );
        assert!(puts.iter().all(|(id, _, _)| id == ID));
    }

    #[test]
    fn a_collection_without_images_records_no_covers() {
        let store = Store::default();
        let links = vec!["https://plain.dev/".to_owned()];
        assert_eq!(
            block_on(refresh_covers(&Pages, &NoCache, &Maker, &store, ID, &links)).unwrap(),
            0
        );
        assert_eq!(*store.count.lock().unwrap(), Some(0));
        assert_eq!(
            *store.deleted_from.lock().unwrap(),
            Some(0),
            "old covers go"
        );
    }

    #[test]
    fn refuses_an_id_that_is_not_a_collection_id() {
        let store = Store::default();
        assert!(matches!(
            block_on(remove_covers(&store, "../other")),
            Err(CoverError::Invalid(_))
        ));
    }
}
