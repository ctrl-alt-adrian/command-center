/**
 * Write-policy verifier: classifies each diff path against hard-ban and
 * soft-ban globs from the pipeline config.
 *
 * Hard-ban presence sets `ok: false` (the verify gate blocks).
 * Soft-ban presence is RECORDED ONLY (returned in `soft`) — the PR phase
 * uses it to add a label and PR-body callout. It does NOT block the gate.
 */

export interface SoftBanHit {
  path: string;
  category: string;
}

export interface WritePolicyResult {
  ok: boolean;
  hard: string[];
  soft: SoftBanHit[];
}

/**
 * Minimal glob → RegExp converter supporting `*`, `**`, and literal segments.
 * - `**` matches any number of segments
 * - `*`  matches any number of characters within a single segment
 * - `.`, `/`, and other chars match literally
 *
 * This is intentionally small — the patterns in the write policy are flat
 * and don't need full POSIX glob semantics (no `?`, no `[...]`).
 */
function globToRegex(glob: string): RegExp {
  // Escape regex special chars except * and /.
  let re = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // ** matches any chars including slashes.
  re = re.replace(/\*\*/g, "§§"); // placeholder
  // single * matches any chars within a segment.
  re = re.replace(/\*/g, "[^/]*");
  // placeholder back to any-chars.
  re = re.replace(/§§/g, ".*");
  return new RegExp(`^${re}$`);
}

function matchesAny(path: string, globs: string[]): boolean {
  for (const g of globs) {
    if (globToRegex(g).test(path)) return true;
  }
  return false;
}

/** Heuristic category label for a soft-ban path (used in PR callouts). */
export function categorize(path: string): string {
  if (path.startsWith("specs/")) return "specs";
  if (path === "Makefile") return "build";
  if (path === "docker-compose.yml") return "compose";
  if (path === "package.json" || path === "pnpm-lock.yaml") return "deps";
  if (path === "go.mod" || path === "go.sum" || path.startsWith("go.work")) return "deps";
  if (path.endsWith("vite.config.ts") || path.endsWith("vitest.config.ts")) return "build";
  return "other";
}

/**
 * Scan a list of diff paths against the policy.
 * @param paths       file paths from `git diff --name-only origin/main...HEAD`
 * @param hardBan     glob patterns that BLOCK the gate when matched
 * @param softBan     glob patterns that LABEL the PR when matched (do NOT block)
 */
export function scanWritePolicy(
  paths: string[],
  hardBan: string[],
  softBan: string[],
): WritePolicyResult {
  const hard: string[] = [];
  const soft: SoftBanHit[] = [];
  for (const p of paths) {
    if (matchesAny(p, hardBan)) {
      hard.push(p);
      continue; // hard-ban takes precedence; don't double-record as soft.
    }
    if (matchesAny(p, softBan)) {
      soft.push({ path: p, category: categorize(p) });
    }
  }
  return { ok: hard.length === 0, hard, soft };
}
