export type GateType = "needs_review" | "deterministic" | "auto_pass";

export type TaskStatus =
  | "pending"
  | "running"
  | "needs_review"
  | "completed"
  | "failed"
  | "paused_backpressure"
  | "paused_user"
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
  /**
   * Optional fan-out: when defined, on advance the processor creates one
   * downstream task per element returned. Each element becomes the `input`
   * of a new next-phase task (merged with this task's input + previousTaskId).
   * Falls back to single-task advance when undefined.
   */
  fanOut?: (task: Task) => Promise<Array<Record<string, unknown>>>;
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
  /**
   * Maximum number of pending tasks for this pipeline to dispatch in one
   * processor tick. When set, this pipeline has its own independent budget.
   * When unset, the pipeline shares the global `PROCESSOR_PER_TICK_CAP` pool
   * with every other pipeline that also has no override.
   */
  perTickCap?: number;
  /**
   * Maximum number of fan-out children to create with `status: pending` at
   * once. Children beyond this count are created as `paused_user` and stay
   * inert until the captain clicks "Resume next batch" on /tasks or the
   * pipeline's dashboard page. This prevents a single approval (e.g. brand
   * discovery picking 204 candidates) from kicking off hundreds of claude
   * calls all at once. Unset = no batch limit (legacy behavior).
   */
  fanOutBatchSize?: number;
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
export const DEFAULT_PROCESSOR_PER_TICK_CAP = 3;
