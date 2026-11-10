//! DevAtlas storage layer.
//!
//! Implements the ports declared by `devatlas-application`: data sources such as browser
//! bookmark files and web page metadata, plus local caches and the library memory; the
//! SQLite database arrives in DEVATLAS-002. Tauri commands only construct these adapters
//! and hand them to use cases.

pub mod brave;
pub mod library_memory;
pub mod preview_cache;
pub mod web_preview;
