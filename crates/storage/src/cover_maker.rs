//! Cover images for shared collections: a web image fetched through the hardened preview client
//! and re-encoded as a small JPEG, so only clean pixels of a bounded size are uploaded.

use std::io::Cursor;

use devatlas_application::community_covers::CoverMaker;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{ImageReader, Limits, Rgb, RgbImage};
use reqwest::header::ACCEPT;
use url::Url;

use crate::web_preview::{WebPreviewError, WebPreviewFetcher, is_public_url};

/// Cards show covers at 16:9; this is twice their size on most screens.
const COVER_WIDTH: u32 = 480;
const COVER_HEIGHT: u32 = 270;
const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;
/// Decoding refuses anything larger, so a crafted image can't exhaust memory.
const MAX_SIDE: u32 = 4_096;
const MAX_DECODE_BYTES: u64 = 64 * 1024 * 1024;
/// The storage bucket's limit per file; busy images are encoded again at lower quality.
const MAX_COVER_BYTES: usize = 100 * 1024;
const QUALITIES: [u8; 3] = [80, 65, 50];

impl CoverMaker for WebPreviewFetcher {
    type Error = WebPreviewError;

    async fn cover(&self, image: &Url) -> Result<Vec<u8>, WebPreviewError> {
        if !is_public_url(image) {
            return Err(WebPreviewError::NotPublic(image.to_string()));
        }
        let bytes = {
            let _permit = self
                .permits
                .acquire()
                .await
                .map_err(|_| WebPreviewError::Closed)?;
            let mut response = self
                .client
                .get(image.clone())
                .header(ACCEPT, "image/*")
                .send()
                .await?;
            if !response.status().is_success() {
                return Err(WebPreviewError::NotAnImage);
            }
            let mut body = Vec::new();
            while let Some(chunk) = response.chunk().await? {
                body.extend_from_slice(&chunk);
                if body.len() > MAX_IMAGE_BYTES {
                    return Err(WebPreviewError::NotAnImage);
                }
            }
            body
        };
        tokio::task::spawn_blocking(move || shrink(&bytes))
            .await
            .map_err(|_| WebPreviewError::Closed)?
    }
}

/// Crops to 16:9 around the centre, scales to the cover size, lays transparency on white and
/// encodes as a JPEG small enough to upload.
fn shrink(bytes: &[u8]) -> Result<Vec<u8>, WebPreviewError> {
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| WebPreviewError::NotAnImage)?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_SIDE);
    limits.max_image_height = Some(MAX_SIDE);
    limits.max_alloc = Some(MAX_DECODE_BYTES);
    reader.limits(limits);
    let rgba = reader
        .decode()?
        .resize_to_fill(COVER_WIDTH, COVER_HEIGHT, FilterType::Triangle)
        .to_rgba8();
    let cover = RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let [r, g, b, a] = rgba.get_pixel(x, y).0;
        Rgb([on_white(r, a), on_white(g, a), on_white(b, a)])
    });
    for quality in QUALITIES {
        let mut jpeg = Vec::new();
        JpegEncoder::new_with_quality(&mut jpeg, quality).encode_image(&cover)?;
        if jpeg.len() <= MAX_COVER_BYTES {
            return Ok(jpeg);
        }
    }
    Err(WebPreviewError::NotAnImage)
}

/// One channel composited over white: JPEG has no transparency, and black looks broken.
fn on_white(channel: u8, alpha: u8) -> u8 {
    let (c, a) = (u16::from(channel), u16::from(alpha));
    u8::try_from((c * a + 255 * (255 - a)) / 255).unwrap_or(u8::MAX)
}

#[cfg(test)]
mod tests {
    use image::{ImageFormat, RgbaImage};

    use super::*;

    #[test]
    fn re_encodes_any_web_image_as_a_small_cover_jpeg() {
        let mut png = Vec::new();
        RgbaImage::new(1200, 630)
            .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
            .unwrap();

        let jpeg = shrink(&png).unwrap();

        let cover = image::load_from_memory(&jpeg).unwrap();
        assert_eq!((cover.width(), cover.height()), (COVER_WIDTH, COVER_HEIGHT));
        assert_eq!(
            image::guess_format(&jpeg).unwrap(),
            ImageFormat::Jpeg,
            "only JPEG leaves this computer"
        );
        assert!(
            jpeg.len() <= MAX_COVER_BYTES,
            "fits the storage bucket's limit"
        );
    }

    #[test]
    fn lays_transparency_on_white() {
        let mut png = Vec::new();
        RgbaImage::new(64, 36)
            .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
            .unwrap();
        let cover = image::load_from_memory(&shrink(&png).unwrap())
            .unwrap()
            .to_rgb8();
        assert!(cover.pixels().all(|pixel| pixel.0.iter().all(|&c| c > 240)));
        assert_eq!(on_white(0, 255), 0);
        assert_eq!(on_white(0, 0), 255);
    }

    #[test]
    fn keeps_even_noisy_images_under_the_upload_limit() {
        // Noise is the worst case for JPEG size.
        let noise = RgbaImage::from_fn(480, 270, |x, y| {
            let n = (x.wrapping_mul(2_654_435_761) ^ y.wrapping_mul(40_503)).to_le_bytes()[0];
            image::Rgba([n, n.rotate_left(3), n.rotate_left(5), 255])
        });
        let mut png = Vec::new();
        noise
            .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
            .unwrap();
        if let Ok(jpeg) = shrink(&png) {
            assert!(jpeg.len() <= MAX_COVER_BYTES);
        }
    }

    #[test]
    fn refuses_what_is_not_an_image() {
        assert!(shrink(b"<svg onload=alert(1)>").is_err());
        assert!(shrink(b"").is_err());
    }
}
