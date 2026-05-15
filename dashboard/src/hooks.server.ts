import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapPipelines } from "../../core/lib/registry-bootstrap.ts";

loadRootDotenv();
bootstrapPipelines();

export async function handle({ event, resolve }) {
  return resolve(event);
}

// Repo-root .env is the canonical config (see .env.example). SvelteKit/Vite
// don't auto-populate process.env from it, so seed it here at server startup.
// Shell-exported vars win over file values.
function loadRootDotenv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(here, "../../.env");
  let raw: string;
  try {
    raw = fs.readFileSync(envPath, "utf-8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
