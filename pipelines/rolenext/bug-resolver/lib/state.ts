import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { withFileLock } from "../../../../core/lib/lock.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to this pipeline's state directory. */
export const STATE_DIR = path.resolve(__dirname, "..", "state");

const FINGERPRINTS_PATH = path.join(STATE_DIR, "fingerprints.json");
const DAILY_COUNTER_PATH = path.join(STATE_DIR, "daily-counter.json");
const KILL_SWITCH_DEFAULT = ".disabled";

export interface FingerprintRecord {
  issueNumber: number;
  status: "in-flight" | "pr-open" | "merged" | "closed";
  prUrl: string | null;
  seenAt: string;
}

export type FingerprintStore = Record<string, FingerprintRecord>;

async function readJsonOr<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonAtomic(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, p);
}

/** Load the fingerprint store. Returns an empty object if missing. */
export async function loadFingerprints(): Promise<FingerprintStore> {
  return await readJsonOr<FingerprintStore>(FINGERPRINTS_PATH, {});
}

/** Persist the fingerprint store. Atomic via tmp + rename. */
export async function saveFingerprints(store: FingerprintStore): Promise<void> {
  await withFileLock(FINGERPRINTS_PATH, async () => {
    await writeJsonAtomic(FINGERPRINTS_PATH, store);
  });
}

/** Upsert a single fingerprint record. */
export async function upsertFingerprint(fp: string, record: FingerprintRecord): Promise<void> {
  await withFileLock(FINGERPRINTS_PATH, async () => {
    const store = await readJsonOr<FingerprintStore>(FINGERPRINTS_PATH, {});
    store[fp] = record;
    await writeJsonAtomic(FINGERPRINTS_PATH, store);
  });
}

/** Prune fingerprint records older than `maxAgeDays` days. Returns count pruned. */
export async function pruneFingerprints(maxAgeDays: number): Promise<number> {
  let pruned = 0;
  await withFileLock(FINGERPRINTS_PATH, async () => {
    const store = await readJsonOr<FingerprintStore>(FINGERPRINTS_PATH, {});
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    for (const [fp, rec] of Object.entries(store)) {
      if (new Date(rec.seenAt).getTime() < cutoff) {
        delete store[fp];
        pruned++;
      }
    }
    if (pruned > 0) await writeJsonAtomic(FINGERPRINTS_PATH, store);
  });
  return pruned;
}

export interface DailyCounter {
  date: string;
  count: number;
}

function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Read the daily ticket counter for the current UTC day. Returns 0 if rolled over. */
export async function readDailyCount(): Promise<number> {
  const today = utcDateString();
  const rec = await readJsonOr<DailyCounter>(DAILY_COUNTER_PATH, { date: today, count: 0 });
  if (rec.date !== today) return 0;
  return rec.count;
}

/** Increment the daily ticket counter (rolls over at UTC midnight). Returns the new count. */
export async function incrementDailyCount(by = 1): Promise<number> {
  let next = 0;
  await withFileLock(DAILY_COUNTER_PATH, async () => {
    const today = utcDateString();
    const rec = await readJsonOr<DailyCounter>(DAILY_COUNTER_PATH, { date: today, count: 0 });
    if (rec.date !== today) {
      next = by;
    } else {
      next = rec.count + by;
    }
    await writeJsonAtomic(DAILY_COUNTER_PATH, { date: today, count: next });
  });
  return next;
}

/** Check whether the kill-switch file is present in the pipeline state dir. */
export async function killSwitchActive(filename = KILL_SWITCH_DEFAULT): Promise<boolean> {
  try {
    await fs.access(path.join(STATE_DIR, filename));
    return true;
  } catch {
    return false;
  }
}
