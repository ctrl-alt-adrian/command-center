import type { PipelineConfig } from "./types.ts";

const pipelines = new Map<string, PipelineConfig>();

export function registerPipeline(config: PipelineConfig): void {
  if (config.phases.length === 0) {
    throw new Error(`Pipeline ${config.id} has no phases`);
  }
  // Idempotent: overwrite is fine. Dev-mode HMR re-evaluates bootstrap; production
  // calls it once at server init.
  pipelines.set(config.id, config);
}

export function getPipeline(id: string): PipelineConfig | undefined {
  return pipelines.get(id);
}

export function listPipelines(): PipelineConfig[] {
  return Array.from(pipelines.values());
}

export function nextPhase(
  config: PipelineConfig,
  currentPhaseId: string,
): string | null {
  const idx = config.phases.findIndex((p) => p.id === currentPhaseId);
  if (idx < 0 || idx >= config.phases.length - 1) return null;
  return config.phases[idx + 1].id;
}

export function previousPhase(
  config: PipelineConfig,
  currentPhaseId: string,
): string | null {
  const idx = config.phases.findIndex((p) => p.id === currentPhaseId);
  if (idx <= 0) return null;
  return config.phases[idx - 1].id;
}

export function getPhase(config: PipelineConfig, phaseId: string) {
  return config.phases.find((p) => p.id === phaseId);
}

export function isFirstPhase(config: PipelineConfig, phaseId: string): boolean {
  return config.phases[0]?.id === phaseId;
}

// Test helper. Production code should not call this.
export function _resetRegistry(): void {
  pipelines.clear();
}
