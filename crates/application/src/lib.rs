//! DevAtlas application layer.
//!
//! Hosts use cases and the interfaces (ports) that infrastructure implements. It may depend
//! on `devatlas-domain`, but never on Tauri, SQLite, or frontend concerns. Delivery
//! mechanisms such as Tauri commands call into this crate instead of holding logic themselves.

pub mod app_info;
pub mod discovery;
pub mod library;
pub mod news;
pub mod organizer;
pub mod preview;
pub mod rankings;
pub mod settings;
pub mod star_history;
