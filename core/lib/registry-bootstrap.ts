// Central pipeline registration. Each new domain adds an import and a register call here.
// core/lib/ does not import any pipeline-specific code other than through this file.

import { registerPipeline } from "./registry.ts";
import { marketingPipeline } from "../../pipelines/marketing/pipeline.config.ts";
import { vaultNuggetsPipeline } from "../../pipelines/vault-nuggets/pipeline.config.ts";
import { competitorsPipeline } from "../../pipelines/competitors/pipeline.config.ts";
import { redditPmfPipeline, redditPmfMetricsPipeline } from "../../pipelines/reddit-pmf/pipeline.config.ts";
import { softwareFactoryHousekeepingPipeline } from "../../pipelines/software-factory/pipeline.config.ts";
import { rolenextBugResolverPipeline } from "../../pipelines/rolenext/bug-resolver/pipeline.config.ts";
import { personalBrandPipeline } from "../../pipelines/personal-brand/pipeline.config.ts";

export function bootstrapPipelines(): void {
  registerPipeline(marketingPipeline);
  registerPipeline(vaultNuggetsPipeline);
  registerPipeline(competitorsPipeline);
  registerPipeline(redditPmfPipeline);
  registerPipeline(redditPmfMetricsPipeline);
  registerPipeline(softwareFactoryHousekeepingPipeline);
  registerPipeline(rolenextBugResolverPipeline);
  registerPipeline(personalBrandPipeline);
}
