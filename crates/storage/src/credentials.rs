//! Secrets in the operating system's credential store (Windows Credential Manager, macOS
//! Keychain, Secret Service on Linux). Never written to a file.

use devatlas_application::settings::SecretStore;
use keyring::Entry;

const ACCOUNT: &str = "github-token";

#[derive(Debug, thiserror::Error)]
#[error("the credential store could not be used: {0}")]
pub struct CredentialError(#[from] keyring::Error);

/// One secret under a service name; dev and release builds use different ones.
pub struct KeyringSecret {
    service: &'static str,
}

impl KeyringSecret {
    pub fn new(service: &'static str) -> Self {
        Self { service }
    }

    fn entry(&self) -> Result<Entry, keyring::Error> {
        Entry::new(self.service, ACCOUNT)
    }
}

impl SecretStore for KeyringSecret {
    type Error = CredentialError;

    fn load(&self) -> Result<Option<String>, CredentialError> {
        match self.entry()?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn save(&self, secret: &str) -> Result<(), CredentialError> {
        Ok(self.entry()?.set_password(secret)?)
    }

    fn delete(&self) -> Result<(), CredentialError> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}
