// ─── Token Estimation (No External Dependencies) ──────────────
// Uses character-ratio heuristics for Chinese/English mixed text.
// Accuracy: ±20% vs real tokenizers — good enough for budget control.

/** Estimate token count for a single text string */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    // CJK Unified Ideographs + common CJK ranges
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3000 && code <= 0x303f) || // CJK symbols & punctuation
      (code >= 0xff00 && code <= 0xffef)    // fullwidth forms
    ) {
      tokens += 1.5; // Chinese char ≈ 1.5 tokens
      i++;
    } else {
      // Collect a word/symbol run
      let word = "";
      while (i < text.length) {
        const c = text.charCodeAt(i);
        if (
          (c >= 0x4e00 && c <= 0x9fff) ||
          (c >= 0x3400 && c <= 0x4dbf) ||
          (c >= 0xf900 && c <= 0xfaff) ||
          (c >= 0x3000 && c <= 0x303f) ||
          (c >= 0xff00 && c <= 0xffef)
        ) break;
        word += text[i];
        i++;
      }
      // English words ≈ 0.25 tokens/word on average (GPT family)
      // Punctuation / whitespace ≈ 0.3 tokens/char
      const words = word.split(/\s+/).filter(Boolean).length;
      const nonSpace = word.replace(/\s/g, "").length;
      tokens += Math.max(words * 0.25, nonSpace * 0.3, word.length * 0.2);
    }
  }
  return Math.ceil(tokens);
}

/** Estimate tokens for an array of messages (including role overhead) */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  const OVERHEAD_PER_MESSAGE = 4; // role, separators, formatting
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content) + OVERHEAD_PER_MESSAGE;
  }
  return total;
}

/**
 * Estimate image tokens based on dimensions.
 * OpenAI low-res: fixed 85 tokens.
 * OpenAI high-res: ~170 per 512x512 tile + 85 base.
 * Anthropic: roughly similar scale.
 */
export function estimateImageTokens(
  width: number = 512,
  height: number = 512,
  detail: "low" | "high" = "low"
): number {
  if (detail === "low") return 85;
  // High-res: ceil(w/512) * ceil(h/512) * 170 + 85
  const tilesW = Math.ceil(width / 512);
  const tilesH = Math.ceil(height / 512);
  return tilesW * tilesH * 170 + 85;
}

/**
 * Estimate tokens for a base64 image data URL.
 * Rough estimate: base64 string length → decoded bytes → dimension guess.
 * For most screenshots/photos, default to high-res estimate.
 */
export function estimateBase64ImageTokens(dataUrl: string): number {
  if (!dataUrl) return 0;
  // base64 encoded size ≈ 4/3 of raw bytes
  // A typical chat image is 512-1024px
  const base64Part = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const approxBytes = (base64Part.length * 3) / 4;
  if (approxBytes < 50_000) {
    // Small image, likely icon or thumbnail
    return 85;
  }
  // Larger images get high-res treatment
  return estimateImageTokens(1024, 1024, "high");
}

/** Simple string hash for cache key generation */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
