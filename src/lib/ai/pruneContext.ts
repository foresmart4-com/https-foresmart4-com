export interface ContextLayer {
  key: string;
  content: string;
  weight: number; // 0.0–1.0; higher = higher priority to keep when budget is tight
}

/**
 * Selects context layers to fit within maxChars.
 * Drops lowest-weight layers first when over budget.
 * Preserves original ordering among kept layers.
 */
export function pruneContext(layers: ContextLayer[], maxChars: number): string {
  const indexed = layers.map((l, origIdx) => ({ ...l, origIdx }));
  const sorted = [...indexed].sort((a, b) => b.weight - a.weight);

  const kept = new Set<number>();
  let total = 0;

  for (const layer of sorted) {
    if (!layer.content) continue;
    if (total + layer.content.length <= maxChars) {
      kept.add(layer.origIdx);
      total += layer.content.length;
    }
  }

  return indexed
    .filter((l) => kept.has(l.origIdx))
    .map((l) => l.content)
    .join("\n");
}
