//! Sealing the synced library. The sync passphrase becomes a key with Argon2id, and the
//! library, as gzipped JSON, is sealed with XChaCha20-Poly1305 bound to the account. Only the
//! sealed copy and the salt leave the computer.

use std::io::{Read, Write};

use argon2::{Algorithm, Argon2, Params, Version};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use devatlas_application::backup::Backup;
use devatlas_application::library_sync::{RemoteHead, SyncCipher};
use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

/// The first byte of a sealed copy, so the format can change later.
const FORMAT: u8 = 1;
const SALT_BYTES: usize = 16;
const KEY_BYTES: usize = 32;
const NONCE_BYTES: usize = 24;
/// OWASP's Argon2id settings: 64 MiB and 3 passes make each guess expensive, even on a GPU.
const MEMORY_KIB: u32 = 64 * 1024;
const PASSES: u32 = 3;
const LANES: u32 = 1;
/// Largest library opened, so a damaged copy can't fill memory as it is decompressed.
const MAX_LIBRARY_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum CipherError {
    #[error("DevAtlas couldn't make your sync key.")]
    Key,
    #[error("DevAtlas couldn't seal your library for syncing.")]
    Seal,
    #[error("The synced copy of your library is damaged.")]
    Damaged,
    #[error("DevAtlas couldn't get random bytes from the system: {0}")]
    Random(#[from] getrandom::Error),
    #[error("Your library couldn't be prepared for syncing: {0}")]
    Encode(#[from] std::io::Error),
}

/// Argon2id key derivation and XChaCha20-Poly1305 sealing.
pub struct SyncCrypto;

/// Binds a seal to its account and to the generation and revision it is stored as, so a copy
/// can't be passed off as another account's or put back in place of a newer one.
fn associated_data(owner: &str, head: &RemoteHead) -> Vec<u8> {
    format!(
        "devatlas-library-sync/v1/{owner}/{}/{}",
        head.generation, head.revision
    )
    .into_bytes()
}

fn cipher(key: &str) -> Result<XChaCha20Poly1305, CipherError> {
    let bytes = STANDARD.decode(key).map_err(|_| CipherError::Key)?;
    XChaCha20Poly1305::new_from_slice(&bytes).map_err(|_| CipherError::Key)
}

fn derive(passphrase: &[u8], salt: &[u8]) -> Result<String, CipherError> {
    let params =
        Params::new(MEMORY_KIB, PASSES, LANES, Some(KEY_BYTES)).map_err(|_| CipherError::Key)?;
    let mut key = [0u8; KEY_BYTES];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(passphrase, salt, &mut key)
        .map_err(|_| CipherError::Key)?;
    Ok(STANDARD.encode(key))
}

impl SyncCipher for SyncCrypto {
    type Error = CipherError;

    fn new_generation(&self) -> Result<String, CipherError> {
        Ok(Uuid::new_v4().to_string())
    }

    fn new_salt(&self) -> Result<String, CipherError> {
        let mut salt = [0u8; SALT_BYTES];
        getrandom::fill(&mut salt)?;
        Ok(STANDARD.encode(salt))
    }

    async fn derive_key(&self, passphrase: &str, salt: &str) -> Result<String, CipherError> {
        let salt = STANDARD.decode(salt).map_err(|_| CipherError::Damaged)?;
        let passphrase = passphrase.nfc().collect::<String>().into_bytes();
        // Deliberately slow, so kept off the async workers.
        tokio::task::spawn_blocking(move || derive(&passphrase, &salt))
            .await
            .map_err(|_| CipherError::Key)?
    }

    fn seal(
        &self,
        key: &str,
        library: &Backup,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<String, CipherError> {
        let mut zipped = GzEncoder::new(Vec::new(), Compression::default());
        zipped.write_all(&serde_json::to_vec(library).map_err(|_| CipherError::Seal)?)?;
        let zipped = zipped.finish()?;
        let mut nonce = [0u8; NONCE_BYTES];
        getrandom::fill(&mut nonce)?;
        let sealed = cipher(key)?
            .encrypt(
                &XNonce::from(nonce),
                Payload {
                    msg: &zipped,
                    aad: &associated_data(owner, head),
                },
            )
            .map_err(|_| CipherError::Seal)?;
        let mut out = Vec::with_capacity(1 + NONCE_BYTES + sealed.len());
        out.push(FORMAT);
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&sealed);
        Ok(STANDARD.encode(out))
    }

    fn open(
        &self,
        key: &str,
        sealed: &str,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<Option<Backup>, CipherError> {
        let bytes = STANDARD.decode(sealed).map_err(|_| CipherError::Damaged)?;
        let Some((&FORMAT, rest)) = bytes.split_first() else {
            return Err(CipherError::Damaged);
        };
        let (nonce, sealed) = rest
            .split_at_checked(NONCE_BYTES)
            .ok_or(CipherError::Damaged)?;
        let nonce = XNonce::try_from(nonce).map_err(|_| CipherError::Damaged)?;
        let Ok(zipped) = cipher(key)?.decrypt(
            &nonce,
            Payload {
                msg: sealed,
                aad: &associated_data(owner, head),
            },
        ) else {
            // A different key, or a copy that isn't this account's at this revision.
            return Ok(None);
        };
        let mut json = Vec::new();
        GzDecoder::new(zipped.as_slice())
            .take(MAX_LIBRARY_BYTES + 1)
            .read_to_end(&mut json)
            .map_err(|_| CipherError::Damaged)?;
        if json.len() as u64 > MAX_LIBRARY_BYTES {
            return Err(CipherError::Damaged);
        }
        serde_json::from_slice(&json)
            .map(Some)
            .map_err(|_| CipherError::Damaged)
    }
}

#[cfg(test)]
mod tests {
    use devatlas_application::library::SavedLink;
    use devatlas_application::library_sync_merge::empty_library;

    use super::*;

    const OWNER: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";

    fn library() -> Backup {
        Backup {
            saved_links: vec![SavedLink {
                url: "https://a.dev/".to_owned(),
                title: "A secret project".to_owned(),
                added_at: 1,
            }],
            ..empty_library()
        }
    }

    fn head() -> RemoteHead {
        RemoteHead {
            generation: "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b41".to_owned(),
            revision: 2,
        }
    }

    fn key(passphrase: &str, salt: &str) -> String {
        tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap()
            .block_on(SyncCrypto.derive_key(passphrase, salt))
            .unwrap()
    }

    #[test]
    fn opens_what_it_sealed_with_the_same_passphrase_only() {
        let salt = SyncCrypto.new_salt().unwrap();
        let right = key("correct horse battery", &salt);
        let sealed = SyncCrypto.seal(&right, &library(), OWNER, &head()).unwrap();

        assert_eq!(
            SyncCrypto.open(&right, &sealed, OWNER, &head()).unwrap(),
            Some(library())
        );
        let wrong = key("correct horse battery!", &salt);
        assert_eq!(
            SyncCrypto.open(&wrong, &sealed, OWNER, &head()).unwrap(),
            None
        );
        assert_eq!(
            SyncCrypto
                .open(&right, &sealed, "another-account", &head())
                .unwrap(),
            None,
            "bound to its account"
        );
        let later = RemoteHead {
            revision: 3,
            ..head()
        };
        assert_eq!(
            SyncCrypto.open(&right, &sealed, OWNER, &later).unwrap(),
            None,
            "bound to its revision"
        );
    }

    #[test]
    fn the_sealed_copy_reveals_nothing_and_never_repeats() {
        let key = key("correct horse battery", &SyncCrypto.new_salt().unwrap());
        let one = SyncCrypto.seal(&key, &library(), OWNER, &head()).unwrap();
        let two = SyncCrypto.seal(&key, &library(), OWNER, &head()).unwrap();

        assert_ne!(one, two, "a fresh nonce each time");
        let bytes = STANDARD.decode(&one).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("secret"));
    }

    #[test]
    fn the_same_passphrase_in_another_unicode_form_gives_the_same_key() {
        let salt = SyncCrypto.new_salt().unwrap();
        assert_eq!(
            key("caf\u{e9} au lait!", &salt),
            key("cafe\u{301} au lait!", &salt)
        );
    }

    #[test]
    fn salts_differ_and_keys_depend_on_them() {
        let (a, b) = (
            SyncCrypto.new_salt().unwrap(),
            SyncCrypto.new_salt().unwrap(),
        );
        assert_ne!(a, b);
        assert_ne!(
            key("correct horse battery", &a),
            key("correct horse battery", &b)
        );
    }

    #[test]
    fn refuses_a_damaged_copy() {
        let key = key("correct horse battery", &SyncCrypto.new_salt().unwrap());
        assert!(
            SyncCrypto
                .open(&key, "not base64!", OWNER, &head())
                .is_err()
        );
        assert!(
            SyncCrypto
                .open(&key, &STANDARD.encode([9u8; 40]), OWNER, &head())
                .is_err()
        );
        assert!(
            SyncCrypto
                .open(&key, &STANDARD.encode([FORMAT; 3]), OWNER, &head())
                .is_err()
        );
    }
}
