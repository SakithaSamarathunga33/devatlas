//! The in-app site viewer: a second native webview placed over the viewer page's content area.
//!
//! Remote pages loaded here get no IPC access: the app capability only covers the `main`
//! webview. Navigation is limited to http(s), and pop-ups open inside the same viewer.

use devatlas_domain::resource::normalize_url;
use serde::{Deserialize, Serialize};
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Runtime, Url, Webview,
    WebviewUrl,
};

const VIEWER_LABEL: &str = "viewer";
const MAIN_LABEL: &str = "main";
const PAGE_LOAD_EVENT: &str = "viewer://page-load";

/// Viewer area in logical pixels, relative to the window's content area.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct ViewerBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl ViewerBounds {
    fn validated(self) -> Result<Self, String> {
        let finite = [self.x, self.y, self.width, self.height]
            .iter()
            .all(|value| value.is_finite());
        if finite && self.width >= 0.0 && self.height >= 0.0 {
            Ok(self)
        } else {
            Err("Invalid viewer bounds.".to_owned())
        }
    }

    fn position(self) -> LogicalPosition<f64> {
        LogicalPosition::new(self.x, self.y)
    }

    fn size(self) -> LogicalSize<f64> {
        LogicalSize::new(self.width, self.height)
    }

    fn rect(self) -> Rect {
        Rect {
            position: self.position().into(),
            size: self.size().into(),
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewerAction {
    Back,
    Forward,
    Reload,
}

#[derive(Clone, Serialize)]
struct PageLoad {
    url: String,
    loading: bool,
}

fn is_web(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https") || url.as_str() == "about:blank"
}

fn message(error: tauri::Error) -> String {
    error.to_string()
}

fn viewer<R: Runtime>(app: &AppHandle<R>) -> Option<Webview<R>> {
    app.get_webview(VIEWER_LABEL)
}

/// Shows `url` in the viewer at `bounds`, creating the viewer webview on first use.
#[tauri::command]
pub async fn viewer_open<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    bounds: ViewerBounds,
) -> Result<(), String> {
    let bounds = bounds.validated()?;
    let url =
        normalize_url(&url).ok_or_else(|| "Only http and https links can be opened.".to_owned())?;

    if let Some(existing) = viewer(&app) {
        existing.navigate(url).map_err(message)?;
        existing.set_bounds(bounds.rect()).map_err(message)?;
        return existing.show().map_err(message);
    }

    let window = app
        .get_window(MAIN_LABEL)
        .ok_or_else(|| "The main window is not available.".to_owned())?;
    let navigator = app.clone();
    let reporter = app.clone();
    let builder = WebviewBuilder::new(VIEWER_LABEL, WebviewUrl::External(url))
        .on_navigation(is_web)
        .on_new_window(move |target, _features| {
            // Keep `target="_blank"` links and `window.open` inside the viewer.
            if is_web(&target)
                && let Some(current) = viewer(&navigator)
                && let Err(error) = current.navigate(target)
            {
                tracing::warn!(%error, "viewer could not follow a new-window link");
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |_webview, payload| {
            let event = PageLoad {
                url: payload.url().to_string(),
                loading: matches!(payload.event(), PageLoadEvent::Started),
            };
            if let Err(error) = reporter.emit_to(MAIN_LABEL, PAGE_LOAD_EVENT, event) {
                tracing::warn!(%error, "could not report a viewer page load");
            }
        });
    window
        .add_child(builder, bounds.position(), bounds.size())
        .map_err(message)?;
    Ok(())
}

/// Keeps the viewer aligned with its placeholder when the layout changes.
#[tauri::command]
pub async fn viewer_set_bounds<R: Runtime>(
    app: AppHandle<R>,
    bounds: ViewerBounds,
) -> Result<(), String> {
    let bounds = bounds.validated()?;
    match viewer(&app) {
        Some(current) => current.set_bounds(bounds.rect()).map_err(message),
        None => Ok(()),
    }
}

/// Destroys the viewer so pages stop running (and playing audio) once you leave.
#[tauri::command]
pub async fn viewer_close<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    match viewer(&app) {
        Some(current) => current.close().map_err(message),
        None => Ok(()),
    }
}

/// Browser-style navigation for the current page.
#[tauri::command]
pub async fn viewer_go<R: Runtime>(app: AppHandle<R>, action: ViewerAction) -> Result<(), String> {
    let current = viewer(&app).ok_or_else(|| "No page is open.".to_owned())?;
    match action {
        ViewerAction::Back => current.eval("history.back()"),
        ViewerAction::Forward => current.eval("history.forward()"),
        ViewerAction::Reload => current.reload(),
    }
    .map_err(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bounds(x: f64, y: f64, width: f64, height: f64) -> ViewerBounds {
        ViewerBounds {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn accepts_finite_non_negative_bounds() {
        assert!(bounds(240.0, 64.0, 1000.0, 700.0).validated().is_ok());
    }

    #[test]
    fn rejects_negative_or_non_finite_bounds() {
        assert!(bounds(0.0, 0.0, -1.0, 10.0).validated().is_err());
        assert!(bounds(f64::NAN, 0.0, 10.0, 10.0).validated().is_err());
        assert!(bounds(0.0, 0.0, 10.0, f64::INFINITY).validated().is_err());
    }

    #[test]
    fn allows_only_web_navigation() {
        assert!(is_web(&Url::parse("https://reactbits.dev").unwrap()));
        assert!(is_web(&Url::parse("about:blank").unwrap()));
        assert!(!is_web(&Url::parse("file:///C:/Windows/win.ini").unwrap()));
        assert!(!is_web(&Url::parse("javascript:alert(1)").unwrap()));
    }
}
