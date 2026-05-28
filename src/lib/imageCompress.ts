// ─── Smart Image Compression for Multimodal API Upload ─────────
// Strategy: preserve semantic information (what the AI "sees"),
// not pixel-perfect fidelity. Vision APIs tokenize images into
// patches — resolution matters more than compression artifacts.

export interface CompressOptions {
  maxDimension?: number;    // Max width/height (default: 1024)
  quality?: number;         // Starting quality 0-1 (default: 0.90)
  maxBytes?: number;        // Target max size (default: 4MB)
  format?: "auto" | "image/webp" | "image/jpeg";  // auto = prefer WEBP
}

export interface CompressResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  format: string;
  quality: number;
  compressionRatio: string;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1024,
  quality: 0.90,
  maxBytes: 4 * 1024 * 1024,
  format: "auto",
};

// Detect if browser supports WEBP
let _webpSupported: boolean | null = null;
function isWebPSupported(): Promise<boolean> {
  if (_webpSupported !== null) return Promise.resolve(_webpSupported);
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    // WEBP encode test
    const supported = canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    _webpSupported = supported;
    resolve(supported);
  });
}

export async function compressImage(
  file: File,
  options?: CompressOptions
): Promise<CompressResult> {
  const opts = { ...DEFAULTS, ...options };
  const img = await loadImage(file);
  const hasAlpha = file.type === "image/png" || file.type === "image/webp";

  // Determine output format
  let outputFormat: "image/webp" | "image/jpeg";
  if (opts.format === "auto") {
    outputFormat = (await isWebPSupported()) ? "image/webp" : "image/jpeg";
  } else {
    outputFormat = opts.format;
  }

  // For images with transparency, composite onto white background if outputting JPEG
  // (WEBP supports alpha, so no need)

  // ─── Step 1: Dimension reduction (preserves semantics) ──────
  // Calculate optimal target dimensions
  const { width: srcW, height: srcH } = img;
  let targetW = srcW;
  let targetH = srcH;

  // Only downscale if source is larger than target
  if (srcW > opts.maxDimension || srcH > opts.maxDimension) {
    const ratio = Math.min(opts.maxDimension / srcW, opts.maxDimension / srcH);
    targetW = Math.round(srcW * ratio);
    targetH = Math.round(srcH * ratio);
  }

  // Small images: don't upscale, just pass through
  if (srcW <= opts.maxDimension && srcH <= opts.maxDimension && file.size <= opts.maxBytes) {
    // Image is already small enough — just re-encode at high quality
    const canvas = drawToCanvas(img, srcW, srcH, hasAlpha && outputFormat === "image/jpeg");
    const dataUrl = canvas.toDataURL(outputFormat, 0.95);
    return makeResult(dataUrl, file.size, srcW, srcH, outputFormat, 0.95);
  }

  // ─── Step 2: Render at target dimensions ────────────────────
  const canvas = drawToCanvas(img, targetW, targetH, hasAlpha && outputFormat === "image/jpeg");

  // ─── Step 3: Quality tuning (binary search for best quality) ─
  // Start high, only reduce if needed. Binary search is faster and
  // finds the optimal quality more precisely than step reduction.
  let lo = 0.50;
  let hi = opts.quality;
  let bestDataUrl = canvas.toDataURL(outputFormat, hi);
  let bestQuality = hi;

  // If already under budget at max quality, done
  if (getDataUrlSize(bestDataUrl) <= opts.maxBytes) {
    return makeResult(bestDataUrl, file.size, targetW, targetH, outputFormat, hi);
  }

  // Binary search for the highest quality that fits
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const test = canvas.toDataURL(outputFormat, mid);
    if (getDataUrlSize(test) <= opts.maxBytes) {
      bestDataUrl = test;
      bestQuality = mid;
      lo = mid; // Try higher quality
    } else {
      hi = mid; // Need lower quality
    }
  }

  // ─── Step 4: If still too large, reduce dimensions further ──
  // This is the last resort — smaller dimensions preserve more
  // semantic info than lower quality (no block artifacts)
  let currentDim = Math.max(targetW, targetH);
  while (getDataUrlSize(bestDataUrl) > opts.maxBytes && currentDim > 256) {
    currentDim = Math.round(currentDim * 0.80);
    const r = Math.min(currentDim / srcW, currentDim / srcH);
    const w = Math.max(1, Math.round(srcW * r));
    const h = Math.max(1, Math.round(srcH * r));
    const c2 = drawToCanvas(img, w, h, hasAlpha && outputFormat === "image/jpeg");
    const test = c2.toDataURL(outputFormat, bestQuality);
    if (getDataUrlSize(test) <= opts.maxBytes) {
      bestDataUrl = test;
      targetW = w;
      targetH = h;
      break;
    }
    // Also try reducing quality further on smaller canvas
    for (let i = 0; i < 4; i++) {
      const q = bestQuality - (i + 1) * 0.05;
      if (q < 0.40) break;
      const testQ = c2.toDataURL(outputFormat, q);
      if (getDataUrlSize(testQ) <= opts.maxBytes) {
        bestDataUrl = testQ;
        bestQuality = q;
        targetW = w;
        targetH = h;
        break;
      }
    }
  }

  return makeResult(bestDataUrl, file.size, targetW, targetH, outputFormat, bestQuality);
}

// ─── Helpers ───────────────────────────────────────────────────

function drawToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  whiteBackground: boolean
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // If compositing onto white (for PNG→JPEG), fill white first
  if (whiteBackground) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

function getDataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round(base64.length * 3 / 4);
}

function makeResult(
  dataUrl: string,
  originalSize: number,
  width: number,
  height: number,
  format: string,
  quality: number
): CompressResult {
  const compressedSize = getDataUrlSize(dataUrl);
  const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(0) : "0";
  return { dataUrl, originalSize, compressedSize, width, height, format, quality, compressionRatio: `${ratio}%` };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
