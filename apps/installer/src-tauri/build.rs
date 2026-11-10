use std::env;
use std::fs;
use std::path::PathBuf;

use tauri_build::{AppManifest, Attributes};

/// Every installer command; tauri-build generates an `allow-*` permission for each.
const COMMANDS: &[&str] = &[
    "get_install_defaults",
    "get_available_space",
    "install",
    "launch_app",
];

type BuildResult = Result<(), Box<dyn std::error::Error + Send + Sync>>;

fn main() -> BuildResult {
    embed_payload()?;
    tauri_build::try_build(Attributes::new().app_manifest(AppManifest::new().commands(COMMANDS)))?;
    Ok(())
}

/// Points `DEVATLAS_PAYLOAD` at the DevAtlas release exe that `src/commands.rs` embeds.
///
/// Override the location with the `DEVATLAS_PAYLOAD` env var. A release build fails without the
/// exe; dev builds (`cargo check`/`clippy`/`test`, `tauri dev`) embed an empty payload instead and
/// the installer refuses to install. `pnpm build:installer` builds the app first.
fn embed_payload() -> BuildResult {
    println!("cargo:rerun-if-env-changed=DEVATLAS_PAYLOAD");
    println!("cargo:rerun-if-env-changed=CARGO_TARGET_DIR");

    let explicit = env::var_os("DEVATLAS_PAYLOAD").map(PathBuf::from);
    let payload = match &explicit {
        Some(path) => path.clone(),
        None => target_dir()?.join("release").join("devatlas-desktop.exe"),
    };
    println!("cargo:rerun-if-changed={}", payload.display());

    let required = explicit.is_some() || env::var("PROFILE")? == "release";
    let embedded = if payload.is_file() {
        // `include_bytes!` resolves relative paths against the source file, not this script.
        payload.canonicalize()?
    } else if required {
        return Err(format!(
            "No DevAtlas app at {}. Run `pnpm build:installer`, or point DEVATLAS_PAYLOAD at devatlas-desktop.exe.",
            payload.display()
        )
        .into());
    } else {
        println!(
            "cargo:warning=No DevAtlas app at {}; this installer will refuse to install. Run `pnpm build:installer`.",
            payload.display()
        );
        let empty = PathBuf::from(env::var("OUT_DIR")?).join("empty-payload");
        fs::write(&empty, [])?;
        empty
    };
    println!("cargo:rustc-env=DEVATLAS_PAYLOAD={}", embedded.display());
    Ok(())
}

fn target_dir() -> Result<PathBuf, env::VarError> {
    if let Some(dir) = env::var_os("CARGO_TARGET_DIR") {
        return Ok(PathBuf::from(dir));
    }
    // apps/installer/src-tauri -> workspace root.
    Ok(PathBuf::from(env::var("CARGO_MANIFEST_DIR")?).join("../../../target"))
}
