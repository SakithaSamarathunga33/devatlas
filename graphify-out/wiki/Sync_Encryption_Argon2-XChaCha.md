# Sync Encryption (Argon2/XChaCha)

> 47 nodes · cohesion 0.07

## Key Concepts

- **library_sync_cipher.rs** (46 connections) — `crates/storage/src/library_sync_cipher.rs`
- **CipherError** (13 connections) — `crates/storage/src/library_sync_cipher.rs`
- **.seal()** (8 connections) — `crates/storage/src/library_sync_cipher.rs`
- **key()** (7 connections) — `crates/storage/src/library_sync_cipher.rs`
- **SyncCrypto** (7 connections) — `crates/storage/src/library_sync_cipher.rs`
- **.new_salt()** (7 connections) — `crates/storage/src/library_sync_cipher.rs`
- **opens_what_it_sealed_with_the_same_passphrase_only()** (6 connections) — `crates/storage/src/library_sync_cipher.rs`
- **.open()** (6 connections) — `crates/storage/src/library_sync_cipher.rs`
- **the_sealed_copy_reveals_nothing_and_never_repeats()** (6 connections) — `crates/storage/src/library_sync_cipher.rs`
- **cipher()** (5 connections) — `crates/storage/src/library_sync_cipher.rs`
- **head()** (5 connections) — `crates/storage/src/library_sync_cipher.rs`
- **library()** (5 connections) — `crates/storage/src/library_sync_cipher.rs`
- **associated_data()** (4 connections) — `crates/storage/src/library_sync_cipher.rs`
- **refuses_a_damaged_copy()** (4 connections) — `crates/storage/src/library_sync_cipher.rs`
- **.derive_key()** (4 connections) — `crates/storage/src/library_sync_cipher.rs`
- **derive()** (3 connections) — `crates/storage/src/library_sync_cipher.rs`
- **salts_differ_and_keys_depend_on_them()** (3 connections) — `crates/storage/src/library_sync_cipher.rs`
- **the_same_passphrase_in_another_unicode_form_gives_the_same_key()** (3 connections) — `crates/storage/src/library_sync_cipher.rs`
- **compression** (2 connections)
- **.new_generation()** (2 connections) — `crates/storage/src/library_sync_cipher.rs`
- **uuid** (2 connections)
- **XChaCha20Poly1305** (2 connections)
- **aead** (1 connections)
- **algorithm** (1 connections)
- **argon2** (1 connections)
- *... and 22 more nodes in this community*

## Relationships

- [library_sync_tests.rs](library_sync_tests.rs.md) (7 shared connections)
- [Self-Update Install](Self-Update_Install.md) (4 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (4 shared connections)
- [Library Sync Three-Way Merge](Library_Sync_Three-Way_Merge.md) (2 shared connections)
- [backup.rs](backup.rs.md) (1 shared connections)
- [agent_usage.rs](agent_usage.rs.md) (1 shared connections)
- [OAuth Loopback Listener](OAuth_Loopback_Listener.md) (1 shared connections)
- [SQLite Database Store](SQLite_Database_Store.md) (1 shared connections)

## Source Files

- `crates/storage/src/library_sync_cipher.rs`

## Audit Trail

- EXTRACTED: 94 (96%)
- INFERRED: 4 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*