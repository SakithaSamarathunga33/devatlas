//! DevAtlas storage layer.
//!
//! Will implement the persistence ports declared by `devatlas-application` (SQLite via SQLx,
//! file-system caches). It depends on `devatlas-domain` for the types it persists and must
//! never be called directly from Tauri commands or the frontend.
//!
//! Intentionally empty in DEVATLAS-001: the database foundation is DEVATLAS-002.
