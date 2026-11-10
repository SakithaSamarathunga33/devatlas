//! DevAtlas storage layer.
//!
//! Implements the ports declared by `devatlas-application`: data sources such as browser
//! bookmark files today, and the SQLite database from DEVATLAS-002. It must never be called
//! directly from Tauri commands' business logic or the frontend; commands only construct it
//! and hand it to an application use case.

pub mod brave;
