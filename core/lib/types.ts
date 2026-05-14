export type GateType = "needs_review" | "deterministic" | "auto_pass";

export type TaskStatus =
  | "pending"
  | "running"
  | "needs_review"
  | "completed"
  | "failed"
  | "paused_backpressure"
  | "cleared_stale";

export interface GateCheckResult {
  pass: boolean;
  reason?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
}

export interface PhaseConfig {
  id: string;
  slashCommand?: string;
  gateType: GateType;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  check?: (task: Task) => Promise<GateCheckResult>;
  run?: (task: Task, ctx: PhaseContext) => Promise<PhaseOutput>;
}

export interface PhaseOutput {
  output?: Record<string, unknown>;
  outputFiles?: Record<string, string>;
}

export interface PhaseContext {
  taskDir: string;
  inputDir: string;
  outputDir: string;
  log: (msg: string, data?: unknown) => void;
}

export interface PipelineConfig {
  id: string;
  description?: string;
  phases: PhaseConfig[];
  backpressureCap?: number;
  cronSchedule?: string;
}

export interface TaskAttempt {
  phaseId: string;
  startedAt: string;
  finishedAt?: string;
  outcome: "ok" | "gate_fail" | "error";
  reason?: string;
}

export interface Task {
  id: string;
  pipelineId: string;
  phaseId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  attempts: TaskAttempt[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  parentId?: string;
  error?: string;
  retryCount?: number;
  gateFailReason?: string;
}

export const DEFAULT_BACKPRESSURE_CAP = 5;
export const DEFAULT_RETRY_MAX = 3;
export const DEFAULT_TIMEOUT_MS = 120_000;
