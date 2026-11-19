//! Use case: link images for shared collections. Small copies of the first links' preview
//! images, made by the owner's app when sharing and kept on the community server, so viewers see
//! what a collection holds without ever contacting the linked sites. A card shows the first few.

use std::future::Future;

use futures_util::{StreamExt, stream};
use url::Url;

use crate::community::{CommunityInputError, MAX_LINK_IMAGES, check_id};
use crate::preview::{self, PreviewCache, PreviewSource};

/// Links read at once, so sharing doesn't wait on each site in turn.
const AT_ONCE: usize = 4;

/// Port: a small, re-encoded JPEG copy of a web image.
pub trait CoverMaker {
    type Error: std::error::Error;

    fn cover(&self, image: &Url) -> impl Future<Output = Result<Vec<u8>, Self::Error>> + Send;
}

/// Port: where a shared collection's link images are kept; only its owner may change them.
pub trait CoverStore {
    type Error: std::error::Error;

    /// Stores the image of the link at `position`.
    fn put_image(
        &self,
        collection: &str,
        position: usize,
        jpeg: &[u8],
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Records which links have an image, which is what pages and cards show.
    fn set_images(
        &self,
        collection: &str,
        positions: &[usize],
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Deletes every stored image except those of the links at `keep`.
    fn delete_images(
        &self,
        collection: &str,
        keep: &[usize],
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum CoverError<E: std::error::Error> {
    #[error(transparent)]
    Invalid(#[from] CommunityInputError),
    #[error(transparent)]
    Store(E),
}

/// Makes images for the first links that have a preview image and stores them. Links whose
/// image can't be read or stored go without, and images left over from an earlier share are
/// deleted, so a removed link's image doesn't stay public once this succeeds. Returns the
/// positions with an image.
pub async fn refresh_covers<P, C, M, S>(
    previews: &P,
    cache: &C,
    maker: &M,
    store: &S,
    collection: &str,
    links: &[String],
) -> Result<Vec<usize>, CoverError<S::Error>>
where
    P: PreviewSource,
    C: PreviewCache,
    M: CoverMaker,
    S: CoverStore,
{
    let collection = check_id(collection)?.to_ascii_lowercase();
    let collection = collection.as_str();
    // Made up front: a closure here would keep the command's future from being `Send`.
    let jobs: Vec<_> = links
        .iter()
        .take(MAX_LINK_IMAGES)
        .enumerate()
        .map(|(position, link)| {
            store_image(previews, cache, maker, store, collection, position, link)
        })
        .collect();
    let stored: Vec<Option<usize>> = stream::iter(jobs).buffered(AT_ONCE).collect().await;
    let positions: Vec<usize> = stored.into_iter().flatten().collect();
    store
        .set_images(collection, &positions)
        .await
        .map_err(CoverError::Store)?;
    store
        .delete_images(collection, &positions)
        .await
        .map_err(CoverError::Store)?;
    Ok(positions)
}

/// Makes and stores the image of the link at `position`; `None` when it has none.
async fn store_image<P, C, M, S>(
    previews: &P,
    cache: &C,
    maker: &M,
    store: &S,
    collection: &str,
    position: usize,
    link: &str,
) -> Option<usize>
where
    P: PreviewSource,
    C: PreviewCache,
    M: CoverMaker,
    S: CoverStore,
{
    let found = preview::get_preview(previews, cache, link).await.ok()?;
    let image = Url::parse(&found.image?).ok()?;
    let jpeg = maker.cover(&image).await.ok()?;
    let put = store.put_image(collection, position, &jpeg).await;
    put.is_ok().then_some(position)
}

/// Removes a collection's images; call before unsharing it, while it is still the caller's.
/// The record goes first, so a page never points at deleted files.
pub async fn remove_covers<S: CoverStore>(
    store: &S,
    collection: &str,
) -> Result<(), CoverError<S::Error>> {
    let collection = check_id(collection)?.to_ascii_lowercase();
    store
        .set_images(&collection, &[])
        .await
        .map_err(CoverError::Store)?;
    store
        .delete_images(&collection, &[])
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
        recorded: Mutex<Option<Vec<usize>>>,
        kept: Mutex<Option<Vec<usize>>>,
    }

    impl CoverStore for Store {
        type Error = Unavailable;

        async fn put_image(&self, id: &str, at: usize, jpeg: &[u8]) -> Result<(), Unavailable> {
            self.puts
                .lock()
                .unwrap()
                .push((id.to_owned(), at, jpeg.to_vec()));
            Ok(())
        }
        async fn set_images(&self, _: &str, positions: &[usize]) -> Result<(), Unavailable> {
            *self.recorded.lock().unwrap() = Some(positions.to_vec());
            Ok(())
        }
        async fn delete_images(&self, _: &str, keep: &[usize]) -> Result<(), Unavailable> {
            *self.kept.lock().unwrap() = Some(keep.to_vec());
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
    fn each_link_with_a_readable_image_gets_one_at_its_position() {
        let links: Vec<String> = [
            "https://plain.dev/",
            "https://img.dev/a",
            "https://img.dev/broken",
            "https://img.dev/b",
        ]
        .map(String::from)
        .to_vec();
        let store = Store::default();

        let positions =
            block_on(refresh_covers(&Pages, &NoCache, &Maker, &store, ID, &links)).unwrap();

        assert_eq!(positions, [1, 3]);
        assert_eq!(*store.recorded.lock().unwrap(), Some(vec![1, 3]));
        assert_eq!(*store.kept.lock().unwrap(), Some(vec![1, 3]), "the rest go");
        let puts = store.puts.lock().unwrap();
        let made: Vec<(usize, &[u8])> = puts.iter().map(|(_, i, b)| (*i, b.as_slice())).collect();
        assert_eq!(made, [(1, &b"/a.png"[..]), (3, &b"/b.png"[..])]);
        assert!(puts.iter().all(|(id, _, _)| id == ID));
    }

    #[test]
    fn only_the_first_links_get_images() {
        let links: Vec<String> = (0..MAX_LINK_IMAGES + 5)
            .map(|n| format!("https://img.dev/{n}"))
            .collect();
        let store = Store::default();

        let positions =
            block_on(refresh_covers(&Pages, &NoCache, &Maker, &store, ID, &links)).unwrap();

        assert_eq!(positions, (0..MAX_LINK_IMAGES).collect::<Vec<_>>());
    }

    #[test]
    fn a_collection_without_images_records_none_and_deletes_old_ones() {
        let store = Store::default();
        let links = vec!["https://plain.dev/".to_owned()];
        assert!(
            block_on(refresh_covers(&Pages, &NoCache, &Maker, &store, ID, &links))
                .unwrap()
                .is_empty()
        );
        assert_eq!(*store.recorded.lock().unwrap(), Some(vec![]));
        assert_eq!(*store.kept.lock().unwrap(), Some(vec![]));
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
