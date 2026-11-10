# Windows development setup

DevAtlas targets Windows 10 (1803+) and Windows 11 first.

## 1. Microsoft C++ Build Tools

Rust's MSVC toolchain needs the Microsoft linker and the Windows SDK.

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   (2022 or newer).
2. Select the **Desktop development with C++** workload, which includes the MSVC toolset and a
   Windows 10/11 SDK.

Verify: `C:\Program Files (x86)\Microsoft Visual Studio\<version>\BuildTools\VC\Tools\MSVC` exists.

## 2. WebView2

WebView2 is preinstalled on Windows 10 (since 1803) and Windows 11. If it is missing, install the
[Evergreen Bootstrapper](https://developer.microsoft.com/microsoft-edge/webview2/). DevAtlas
installers also download it automatically when needed.

## 3. Rust

Install [rustup](https://rustup.rs) and accept the default `x86_64-pc-windows-msvc` host. Open a
new terminal so `%USERPROFILE%\.cargo\bin` is on `PATH`. The repository's `rust-toolchain.toml`
selects the stable channel and installs `rustfmt` and `clippy` on first use.

```powershell
rustc --version
cargo --version
```

## 4. Node.js and pnpm

Install Node.js ≥ 22.22 (LTS 24 recommended), then pnpm 10:

```powershell
corepack enable
# or: npm install -g pnpm@10
pnpm --version
```

## 5. Run

```powershell
pnpm install
pnpm dev
```

The first `pnpm dev` / `pnpm build` compiles the full Tauri dependency tree and takes a few
minutes; subsequent builds are incremental.

## Troubleshooting

- **`link.exe` not found / `LNK1181`:** the C++ workload or Windows SDK is missing (step 1).
- **`cargo` not recognized:** open a new terminal after installing rustup.
- **Port 1420 already in use:** another `pnpm dev` is running; Vite uses a fixed port because the
  Tauri CLI expects it.
