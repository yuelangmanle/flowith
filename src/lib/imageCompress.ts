// ─── Image compression for multimodal API upload ──────────────
// Most vision APIs internally resize to ~768px max dimension.
// We compress client-side to save bandwidth and avoid request size limits.

export interface CompressOptions {
  maxDimension?: number;    // Max width or height in pixels (default: 1024)
  quality?: number;         // JPEG quality 0-1 (default: 0.85)
  maxBytes?: number;        // Max output size in bytes (default: 4MB)
  format?: "image/jpeg" | "image/webp";  // Output format (default: jpeg)
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1024,
  quality: 0.85,
  maxBytes: 4 * 1024 * 1024, // 4MB — safe for all multimodal APIs
  format: "image/jpeg",
};

/**
 * Compress an image file for API upload.
 * Returns a base64 data URL ready to send in the API request.
 */
export async function compressImage(
  file: File,
  options?: CompressOptions
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number; width: number; height: number }> {
  const opts = { ...DEFAULTS, ...options };

  // Load image
  const img = await loadImage(file);

  // Calculate new dimensions (maintain aspect ratio)
  let { width, height } = img;
  if (width > opts.maxDimension || height > opts.maxDimension) {
    const ratio = Math.min(opts.maxDimension / width, opts.maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Draw to canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to data URL with quality control
  let quality = opts.quality;
  let dataUrl = canvas.toDataURL(opts.format, quality);

  // If still too large, reduce quality iteratively
  let attempts = 0;
  while (getDataUrlSize(dataUrl) > opts.maxBytes && quality > 0.3 && attempts < 5) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL(opts.format, quality);
    attempts++;
  }

  // If still too large after quality reduction, reduce dimensions
  let currentMaxDim = opts.maxDimension;
  while (getDataUrlSize(dataUrl) > opts.maxBytes && currentMaxDim > 256) {
    currentMaxDim = Math.round(currentMaxDim * 0.75);
    const r = Math.min(currentMaxDim / img.width, currentMaxDim / img.height);
    const w = Math.round(img.width * r);
    const h = Math.round(img.height * r);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    dataUrl = canvas.toDataURL(opts.format, quality);
  }

  return {
    dataUrl,
    originalSize: file.size,
    compressedSize: getDataUrlSize(dataUrl),
    width: canvas.width,
    height: canvas.height,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

function getDataUrlSize(dataUrl: string): number {
  // base64 size = 3/4 of the encoded string length
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round(base64.length * 3 / 4);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
