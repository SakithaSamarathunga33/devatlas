//! DevAtlas storage layer.
//!
//! Implements the ports declared by `devatlas-application`: data sources such as browser
//! bookmark files and web page metadata, plus local caches, saved links, the library memory
//! and the SQLite database. Tauri commands only construct these adapters and hand them to
//! use cases.

pub mod chromium;
pub mod database;
pub mod github;
pub mod json_file;
pub mod library_memory;
pub mod news;
pub mod preview_cache;
pub mod rankings;
pub mod saved_links;
pub mod settings;
pub mod star_history;
pub mod web_preview;
