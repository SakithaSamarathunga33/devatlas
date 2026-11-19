# web_preview.rs (4)

> 8 nodes · cohesion 0.39

## Key Concepts

- **extract_preview()** (13 connections) — `crates/storage/src/web_preview.rs`
- **page()** (8 connections) — `crates/storage/src/web_preview.rs`
- **drops_images_and_icons_that_point_at_private_addresses()** (3 connections) — `crates/storage/src/web_preview.rs`
- **extracts_og_image_and_apple_touch_icon_resolved_against_the_page()** (3 connections) — `crates/storage/src/web_preview.rs`
- **extracts_the_title_preferring_og_title_and_tidying_whitespace()** (3 connections) — `crates/storage/src/web_preview.rs`
- **falls_back_to_twitter_image_and_shortcut_icon()** (3 connections) — `crates/storage/src/web_preview.rs`
- **uses_favicon_ico_and_ignores_non_web_image_urls()** (3 connections) — `crates/storage/src/web_preview.rs`
- **drops_the_default_icon_of_a_private_page()** (2 connections) — `crates/storage/src/web_preview.rs`

## Relationships

- [web_preview.rs](web_preview.rs.md) (9 shared connections)
- [web_preview.rs (3)](web_preview.rs_3.md) (4 shared connections)
- [web_preview.rs (2)](web_preview.rs_2.md) (3 shared connections)

## Source Files

- `crates/storage/src/web_preview.rs`

## Audit Trail

- EXTRACTED: 24 (89%)
- INFERRED: 3 (11%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*