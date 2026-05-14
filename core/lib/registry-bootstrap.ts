// Central pipeline registration. Each new domain adds an import and a register call here.
// core/lib/ does not import any pipeline-specific code other than through this file.

import { registerPipeline } from "./registry.ts";
import { testPipeline } from "../../pipelines/test-pipeline/pipeline.config.ts";
import { marketingPipeline } from "../../pipelines/marketing/pipeline.config.ts";
import { vaultNuggetsPipeline } from "../../pipelines/vault-nuggets/pipeline.config.ts";

export function bootstrapPipelines(): void {
  registerPipeline(testPipeline);
  registerPipeline(marketingPipeline);
  registerPipeline(vaultNuggetsPipeline);
  // Phase 4: registerPipeline(competitorsPipeline);
  // Phase 5: registerPipeline(redditPmfPipeline); registerPipeline(redditPmfMetricsPipeline);
  // Phase 6: registerPipeline(softwareFactoryHousekeepingPipeline);
}
