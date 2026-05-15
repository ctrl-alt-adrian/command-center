import fs from "fs/promises";
import path from "path";
import type { Task, TaskStatus, TaskAttempt } from "./types.ts";
import { TASKS_DIR, taskDir, taskFile, phaseDir } from "./paths.ts";
import { generateId, nowIso } from "./utils.ts";
import { withFileLock } from "./lock.ts";
import { ttlCache } from "./cache.ts";
import { readJsonOrNull } from "./io.ts";

export interface CreateTaskInput {
  pipelineId: string;
  phaseId: string;
  input?: Record<string, unknown>;
  parentId?: string;
  status?: TaskStatus;
}

export async function createTask(opts: CreateTaskInput): Promise<Task> {
  const id = generateId();
  const task: Task = {
    id,
    pipelineId: opts.pipelineId,
    phaseId: opts.phaseId,
    status: opts.status ?? "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    attempts: [],
    input: opts.input ?? {},
    parentId: opts.parentId,
    retryCount: 0,
  };
  await fs.mkdir(taskDir(id), { recursive: true });
  await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
  tasksCache.bust();
  return task;
}

export async function getTask(id: string): Promise<Task | null> {
  return readJsonOrNull<Task>(taskFile(id));
}

async function listTasksUncached(): Promise<Task[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(TASKS_DIR);
  } catch {
    return [];
  }
  const loaded = await Promise.all(entries.map((e) => getTask(e)));
  const tasks = loaded.filter((t): t is Task => t !== null);
  // Sort: running, pending, needs_review, paused (both kinds), failed, completed, cleared_stale
  const weight: Record<TaskStatus, number> = {
    running: 0,
    pending: 1,
    paused_user: 2,
    paused_backpressure: 3,
    needs_review: 4,
    failed: 5,
    completed: 6,
    cleared_stale: 7,
  };
  tasks.sort((a, b) => {
    const sw = weight[a.status] - weight[b.status];
    if (sw !== 0) return sw;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return tasks;
}

const tasksCache = ttlCache(listTasksUncached, 2000);

export function bustTasksCache(): void {
  tasksCache.bust();
}

export async function listTasks(): Promise<Task[]> {
  return tasksCache.get();
}

export async function listTasksByPipeline(pipelineId: string): Promise<Task[]> {
  const all = await listTasks();
  return all.filter((t) => t.pipelineId === pipelineId);
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, "status" | "phaseId" | "output" | "error" | "retryCount" | "gateFailReason">>,
): Promise<Task | null> {
  return withFileLock(taskFile(id), async () => {
    const task = await getTask(id);
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: nowIso() });
    await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
    tasksCache.bust();
    return task;
  });
}

export async function appendAttempt(id: string, attempt: TaskAttempt): Promise<void> {
  await withFileLock(taskFile(id), async () => {
    const task = await getTask(id);
    if (!task) return;
    task.attempts.push(attempt);
    task.updatedAt = nowIso();
    await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
    tasksCache.bust();
  });
}

export async function deleteTask(id: string): Promise<void> {
  await fs.rm(taskDir(id), { recursive: true, force: true });
  tasksCache.bust();
}

export async function writePhaseOutput(
  taskId: string,
  phaseId: string,
  content: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const dir = phaseDir(taskId, phaseId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "output.md"), content, "utf-8");
  if (meta) {
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  }
}

export async function readPhaseOutput(taskId: string, phaseId: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(phaseDir(taskId, phaseId), "output.md"), "utf-8");
  } catch {
    return null;
  }
}
