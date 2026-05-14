import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { buildHandoff, writeHandoff } from "../lib/handoff.ts";
import type { InvestigateOutcome } from "../lib/investigate-agent.ts";

interface WriteHandoffInput {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueBody: string;
  pageUrl: string;
  attempt: number;
  priorPrUrl: string | null;
}

interface TriageOutputSlice {
  investigate?: InvestigateOutcome;
}

export async function runWriteHandoff(task: Task, ctx: PhaseContext): Promise<PhaseOutput> {
  const input = task.input as unknown as WriteHandoffInput;
  // The triage phase's output was merged into this task's input via advanceOrComplete.
  // The investigate outcome lives under input.investigate.
  const investigate = (task.input as unknown as TriageOutputSlice).investigate;

  if (!investigate) {
    throw new Error("write-handoff: no investigate outcome on task input");
  }

  const body = buildHandoff({
    issueNumber: input.issueNumber,
    issueUrl: input.issueUrl,
    issueTitle: input.issueTitle,
    issueBody: input.issueBody,
    pageUrl: input.pageUrl,
    attempt: input.attempt,
    priorPrUrl: input.priorPrUrl,
    investigate,
  });

  const handoffPath = await writeHandoff(ctx.outputDir, body);
  ctx.log("handoff-written", { path: handoffPath, length: body.length });

  return { output: { handoffPath, handoffLength: body.length } };
}
