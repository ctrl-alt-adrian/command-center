import { error } from "@sveltejs/kit";
import fs from "fs/promises";
import path from "path";
import { getTask } from "../../../../../core/lib/tasks.ts";
import { getPipeline } from "../../../../../core/lib/registry.ts";
import { phaseDir } from "../../../../../core/lib/paths.ts";

export async function load({ params }) {
  const task = await getTask(params.id);
  if (!task) throw error(404, `task not found: ${params.id}`);
  const pipeline = getPipeline(task.pipelineId);

  const phaseOutputs: Array<{ phaseId: string; output: string | null; meta: string | null }> = [];
  if (pipeline) {
    for (const ph of pipeline.phases) {
      const dir = phaseDir(task.id, ph.id);
      let output: string | null = null;
      let meta: string | null = null;
      try {
        output = await fs.readFile(path.join(dir, "output.md"), "utf-8");
      } catch {}
      try {
        meta = await fs.readFile(path.join(dir, "meta.json"), "utf-8");
      } catch {}
      if (output || meta) phaseOutputs.push({ phaseId: ph.id, output, meta });
    }
  }

  return {
    task,
    pipelineExists: !!pipeline,
    phaseOutputs,
  };
}
