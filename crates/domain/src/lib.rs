//! DevAtlas domain layer.
//!
//! Owns the core business vocabulary of DevAtlas. This crate is the innermost layer:
//! it must not depend on Tauri, SQLite/SQLx, HTTP clients, or any other infrastructure.
//!
//! The resource model (resources, collections, tags, …) is introduced together with the
//! features that need it, starting with DEVATLAS-002. Do not add speculative types here.

/// The product's display name — the single backend source of truth for it.
pub const PRODUCT_NAME: &str = "DevAtlas";
