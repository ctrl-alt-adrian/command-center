import path from "path";
import { fileURLToPath } from "url";
import { COMMAND_CENTER_ROOT } from "../../../core/lib/paths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BRAND_DRAFTS_DIR = path.join(COMMAND_CENTER_ROOT, "drafts", "brand");
export const CLI_DIR = path.join(__dirname, "..", "cli");

export function draftSetDir(slug: string): string {
  return path.join(BRAND_DRAFTS_DIR, slug);
}
