import path from "path";
import {
  COMMAND_CENTER_ROOT,
  DRAFTS_DIR as CC_DRAFTS_DIR,
  SIGNALS_DIR as CC_SIGNALS_DIR,
  LOGS_DIR as CC_LOGS_DIR,
  LEGACY_SESSIONS_ROOT,
} from "../../../core/lib/paths.ts";

const MARKETING_DIR = path.resolve(import.meta.dirname, "..");
const CLI_DIR = path.join(MARKETING_DIR, "cli");
const SLOP_RULES_DIR = path.join(MARKETING_DIR, "slop-rules");
const KB_DIR = process.env.KB_DIR ?? LEGACY_SESSIONS_ROOT;
const DRAFTS_DIR = CC_DRAFTS_DIR;
const SIGNALS_DIR = CC_SIGNALS_DIR;
const ERRORS_LOG = path.join(CC_LOGS_DIR, "marketing-errors.log");

export {
  COMMAND_CENTER_ROOT,
  MARKETING_DIR,
  CLI_DIR,
  SLOP_RULES_DIR,
  KB_DIR,
  DRAFTS_DIR,
  SIGNALS_DIR,
  ERRORS_LOG,
};
