/**
 * High-Efficiency Client-Side Image Resizer & Thumbnail Compressor
 * Prevents exceeding localStorage / IndexedDB quotas by downscaling uploaded
 * account logos and avatars to maximum 100x100px before Base64 storage.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

/**
 * Resizes and compresses an image File or Base64 data URL to a lightweight thumbnail.
 */
export async function compressImageThumbnail(
  source: File | string,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 100,
    maxHeight = 100,
    quality = 0.85,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved downscaled dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof source === 'string' ? source : '');
          return;
        }

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight data URL (WebP preferred, falls back gracefully)
        let compressedDataUrl = canvas.toDataURL(mimeType, quality);
        
        // Fallback to jpeg if browser doesn't support webp export
        if (!compressedDataUrl.startsWith(`data:${mimeType}`)) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        console.log(`[Storage]: Compressed image thumbnail to ${width}x${height} (${Math.round(compressedDataUrl.length / 1024)} KB)`);
        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('[Storage]: Image compression failed, returning original', err);
        resolve(typeof source === 'string' ? source : '');
      }
    };

    img.onerror = (err) => {
      console.warn('[Storage]: Failed to load image for compression', err);
      reject(err);
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}
