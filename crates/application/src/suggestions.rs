//! Which of Explorer's suggested links the user removed. The links themselves are fixed data
//! in the UI; only the removals are remembered.

use std::future::Future;

use crate::organizer::{InvalidInput, OrganizerError, check_id};

/// More than the UI ever suggests, so one call can't run unbounded.
const MAX_RESTORED: usize = 1_000;

/// Port: remembers the removed suggestions by id.
pub trait SuggestionStore {
    type Error: std::error::Error;

    fn removed_suggestions(&self) -> impl Future<Output = Result<Vec<String>, Self::Error>> + Send;
    fn remove_suggestion(&self, id: &str) -> impl Future<Output = Result<(), Self::Error>> + Send;
    fn restore_suggestions(
        &self,
        ids: &[String],
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

pub async fn list_removed<S: SuggestionStore>(
    store: &S,
) -> Result<Vec<String>, OrganizerError<S::Error>> {
    store
        .removed_suggestions()
        .await
        .map_err(OrganizerError::Store)
}

pub async fn remove_suggestion<S: SuggestionStore>(
    store: &S,
    id: &str,
) -> Result<(), OrganizerError<S::Error>> {
    check_id(id)?;
    store
        .remove_suggestion(id)
        .await
        .map_err(OrganizerError::Store)
}

pub async fn restore_suggestions<S: SuggestionStore>(
    store: &S,
    ids: &[String],
) -> Result<(), OrganizerError<S::Error>> {
    if ids.len() > MAX_RESTORED {
        return Err(InvalidInput::InvalidId.into());
    }
    ids.iter().try_for_each(|id| check_id(id))?;
    store
        .restore_suggestions(ids)
        .await
        .map_err(OrganizerError::Store)
}

#[cfg(test)]
mod tests {
    use std::pin::pin;
    use std::sync::Mutex;
    use std::task::{Context, Poll, Waker};

    use super::*;

    #[derive(Default)]
    struct FakeStore(Mutex<Vec<String>>);

    impl SuggestionStore for FakeStore {
        type Error = std::convert::Infallible;

        async fn removed_suggestions(&self) -> Result<Vec<String>, Self::Error> {
            Ok(self.0.lock().unwrap().clone())
        }

        async fn remove_suggestion(&self, id: &str) -> Result<(), Self::Error> {
            self.0.lock().unwrap().push(id.to_owned());
            Ok(())
        }

        async fn restore_suggestions(&self, ids: &[String]) -> Result<(), Self::Error> {
            self.0.lock().unwrap().retain(|id| !ids.contains(id));
            Ok(())
        }
    }

    /// The fake resolves immediately, so a single poll completes the future.
    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    #[test]
    fn removes_and_restores_a_suggestion() {
        let store = FakeStore::default();

        block_on(remove_suggestion(&store, "docs.rs")).unwrap();
        assert_eq!(block_on(list_removed(&store)).unwrap(), ["docs.rs"]);

        block_on(restore_suggestions(&store, &["docs.rs".to_owned()])).unwrap();
        assert!(block_on(list_removed(&store)).unwrap().is_empty());
    }

    #[test]
    fn refuses_an_empty_id() {
        let store = FakeStore::default();

        let result = block_on(remove_suggestion(&store, ""));

        assert!(matches!(
            result,
            Err(OrganizerError::Invalid(InvalidInput::InvalidId))
        ));
        assert!(store.0.lock().unwrap().is_empty());
    }

    #[test]
    fn refuses_to_restore_too_many_at_once() {
        let ids = vec!["docs.rs".to_owned(); MAX_RESTORED + 1];

        let result = block_on(restore_suggestions(&FakeStore::default(), &ids));

        assert!(matches!(
            result,
            Err(OrganizerError::Invalid(InvalidInput::InvalidId))
        ));
    }
}
