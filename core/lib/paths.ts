import path from "path";

export const COMMAND_CENTER_ROOT =
  process.env.COMMAND_CENTER_ROOT ?? path.resolve(import.meta.dirname ?? __dirname, "..", "..");

export const TASKS_DIR = path.join(COMMAND_CENTER_ROOT, "tasks");
export const SIGNALS_DIR = path.join(COMMAND_CENTER_ROOT, "signals");
export const DRAFTS_DIR = path.join(COMMAND_CENTER_ROOT, "drafts");
export const VAULT_ROOT = process.env.VAULT_ROOT ?? path.join(COMMAND_CENTER_ROOT, "vault");
export const LEGACY_SESSIONS_ROOT =
  process.env.LEGACY_SESSIONS_ROOT ?? path.join(process.env.HOME ?? "", "Documents", "rolenext", "sessions");
export const LOGS_DIR = path.join(COMMAND_CENTER_ROOT, "logs");
export const PROCESSOR_STATE_FILE = path.join(LOGS_DIR, "processor-state.json");

export function taskDir(id: string): string {
  return path.join(TASKS_DIR, id);
}

export function taskFile(id: string): string {
  return path.join(taskDir(id), "task.json");
}

export function phaseDir(taskId: string, phaseId: string): string {
  return path.join(taskDir(taskId), phaseId);
}
