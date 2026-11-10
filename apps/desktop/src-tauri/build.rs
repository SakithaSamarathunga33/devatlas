use tauri_build::{AppManifest, Attributes};

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Declaring the app's commands makes tauri-build generate `allow-*` permissions for them,
    // so each command must be granted explicitly in `capabilities/` (least privilege).
    tauri_build::try_build(
        Attributes::new().app_manifest(AppManifest::new().commands(&["get_app_info"])),
    )?;
    Ok(())
}
