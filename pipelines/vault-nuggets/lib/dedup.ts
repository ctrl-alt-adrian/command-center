/** Token-based Jaccard similarity for short text. */
export function jaccard(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one",
  "our", "out", "his", "has", "had", "their", "from", "with", "about", "into", "than",
  "this", "that", "these", "those", "have", "been", "were", "they", "them", "your",
  "what", "when", "where", "which", "while", "would", "could", "should",
]);
