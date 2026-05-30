import fs from "fs/promises";
import path from "path";
import { LOGS_DIR } from "./paths.ts";
import { readJsonOrNull } from "./io.ts";
import { withFileLock } from "./lock.ts";

const PIPELINE_STATE_FILE = path.join(LOGS_DIR, "pipeline-state.json");

interface PipelineStateShape {
  [pipelineId: string]: { enabled: boolean };
}

async function readState(): Promise<PipelineStateShape> {
  return (await readJsonOrNull<PipelineStateShape>(PIPELINE_STATE_FILE)) ?? {};
}

/** Default true — pipelines are enabled unless explicitly disabled in the state file. */
export async function isPipelineEnabled(pipelineId: string): Promise<boolean> {
  const state = await readState();
  return state[pipelineId]?.enabled ?? true;
}

export async function getAllPipelineEnabledMap(): Promise<Record<string, boolean>> {
  const state = await readState();
  const out: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(state)) out[id] = v.enabled;
  return out;
}

export async function setPipelineEnabled(pipelineId: string, enabled: boolean): Promise<void> {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await withFileLock(PIPELINE_STATE_FILE, async () => {
    const state = await readState();
    state[pipelineId] = { enabled };
    await fs.writeFile(PIPELINE_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  });
}
