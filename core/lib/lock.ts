import fs from "fs/promises";
import path from "path";

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 25;

/**
 * Advisory file lock. Uses O_EXCL create of a `.lock` sibling.
 * If the lock is held > LOCK_TIMEOUT_MS we steal it (assume the holder crashed).
 */
export async function withFileLock<T>(targetPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${targetPath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      const fd = await fs.open(lockPath, "wx");
      await fd.close();
      try {
        return await fn();
      } finally {
        await fs.unlink(lockPath).catch(() => {});
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "EEXIST") throw err;
      // Lock exists. Check if it's stale.
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        // Lock just disappeared, loop and try again.
      }
      if (Date.now() > deadline) {
        throw new Error(`withFileLock timed out for ${targetPath}`);
      }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
}
