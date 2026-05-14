import { pipelineStatus } from "../../../core/lib/processor.ts";

export async function load() {
  return { pipelines: await pipelineStatus() };
}
