// AI output refinement — concise, professional, balanced uncertainty.
const HEDGES = ["may", "could", "appears to", "suggests", "tends to"];
const BANNED = [
  /\bguaranteed\b/gi, /\bcertain(ly)?\b/gi, /\b100%\b/g, /\balways\b/gi,
  /\bnever\b/gi, /\bdefinitely\b/gi, /\bobviously\b/gi,
];

/** Trim, dedupe sentences, cap length. */
export function refineText(input: string, maxSentences = 3): string {
  if (!input) return "";
  let t = input.trim().replace(/\s+/g, " ");
  for (const re of BANNED) t = t.replace(re, "likely");
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= maxSentences) break;
  }
  return out.join(" ");
}

/** Insert a hedge if a strong claim lacks one. */
export function softenClaim(text: string): string {
  if (!text) return text;
  if (HEDGES.some((h) => text.toLowerCase().includes(h))) return text;
  return text.replace(/^(\w+)/, (m) => `${m} likely`);
}

/** Compose a concise tactical headline. */
export function tacticalHeadline(asset: string, bias: string, action: string, conf: number): string {
  const c = Math.round(conf);
  const tone = c >= 75 ? "high-conviction" : c >= 55 ? "constructive" : "tentative";
  return `${asset} · ${tone} ${bias} bias — ${action} (${c}% conf).`;
}

/** Strip filler words and repeated qualifiers from long AI prose. */
export function compress(text: string, charLimit = 320): string {
  if (!text) return "";
  let t = refineText(text, 4)
    .replace(/\b(very|really|extremely|just|simply|actually|basically)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (t.length > charLimit) t = t.slice(0, charLimit - 1).replace(/[, ]+\w*$/, "") + "…";
  return t;
}
