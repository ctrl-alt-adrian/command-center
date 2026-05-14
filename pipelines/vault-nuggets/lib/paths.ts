import path from "path";
import { VAULT_ROOT, LEGACY_SESSIONS_ROOT } from "../../../core/lib/paths.ts";

const NUGGETS_DIR = path.resolve(import.meta.dirname, "..");
const CLI_DIR = path.join(NUGGETS_DIR, "cli");
const STAGING_ROOT = path.join(VAULT_ROOT, ".staging");

function stagingDir(taskId: string): string {
  return path.join(STAGING_ROOT, taskId);
}

export { VAULT_ROOT, LEGACY_SESSIONS_ROOT, NUGGETS_DIR, CLI_DIR, STAGING_ROOT, stagingDir };
