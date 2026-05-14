import fs from "fs/promises";
import path from "path";
import { LOGS_DIR } from "./paths.ts";
import { nowIso } from "./utils.ts";

export async function logEvent(kind: string, payload: Record<string, unknown>): Promise<void> {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  const day = nowIso().slice(0, 10);
  const line = JSON.stringify({ ts: nowIso(), kind, ...payload }) + "\n";
  await fs.appendFile(path.join(LOGS_DIR, `processor-${day}.log`), line, "utf-8");
}

export function consoleLog(kind: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`[${kind}]`, JSON.stringify(payload));
}
