import fs from "fs/promises";
import path from "path";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { getPipeline } from "../../../../core/lib/registry.ts";
import { LOGS_DIR } from "../../../../core/lib/paths.ts";
import {
  RESERVED_SOFTWARE_FACTORY_PIPELINES,
  softwareFactoryHousekeepingPipeline,
} from "../../../../pipelines/software-factory/pipeline.config.ts";

interface RecentLog {
  date: string;
  lineCount: number;
  cleared: number;
}

async function recentHousekeepingLogs(limit = 7): Promise<RecentLog[]> {
  const dir = path.join(LOGS_DIR, "housekeeping");
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const dated = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.log$/.test(f)).sort().reverse().slice(0, limit);
  const out: RecentLog[] = [];
  for (const f of dated) {
    const raw = await fs.readFile(path.join(dir, f), "utf-8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    const cleared = lines.filter((l) => l.includes("cleared taskId=")).length;
    out.push({ date: f.slice(0, 10), lineCount: lines.length, cleared });
  }
  return out;
}

export async function load() {
  const pipeline = getPipeline(softwareFactoryHousekeepingPipeline.id);
  const tasks = await listTasksByPipeline(softwareFactoryHousekeepingPipeline.id);
  const logs = await recentHousekeepingLogs();

  return {
    active: pipeline
      ? [{
          id: pipeline.id,
          description: pipeline.description ?? "",
          cronSchedule: pipeline.cronSchedule ?? "",
          taskCount: tasks.length,
          lastRun: tasks[0]?.updatedAt ?? null,
          lastStatus: tasks[0]?.status ?? null,
        }]
      : [],
    reserved: RESERVED_SOFTWARE_FACTORY_PIPELINES,
    logs,
  };
}
