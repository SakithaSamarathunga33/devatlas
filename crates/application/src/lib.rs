//! DevAtlas application layer.
//!
//! Hosts use cases and the interfaces (ports) that infrastructure implements. It may depend
//! on `devatlas-domain`, but never on Tauri, SQLite, or frontend concerns. Delivery
//! mechanisms such as Tauri commands call into this crate instead of holding logic themselves.

pub mod app_info;
pub mod library;
pub mod preview;
