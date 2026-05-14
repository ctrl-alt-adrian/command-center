import fs from "fs/promises";
import path from "path";
import type { InvestigateOutcome, InvestigateResult } from "./investigate-agent.ts";

export interface HandoffInput {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueBody: string;
  pageUrl: string;
  attempt: number;
  priorPrUrl: string | null;
  investigate: InvestigateOutcome;
}

/** Build the handoff markdown body from the triage inputs and investigate output. */
export function buildHandoff(input: HandoffInput): string {
  const parts: string[] = [];
  parts.push(`# Bug handoff — issue #${input.issueNumber}: ${input.issueTitle}`);
  parts.push("");
  parts.push(`**Ticket:** ${input.issueUrl}`);
  if (input.pageUrl) parts.push(`**Page URL:** ${input.pageUrl}`);
  parts.push(`**Attempt:** ${input.attempt}`);
  if (input.priorPrUrl) parts.push(`**Prior PR:** ${input.priorPrUrl}`);
  parts.push("");

  parts.push("## Bug summary");
  parts.push("");
  parts.push(input.issueBody.trim() || "(no body provided)");
  parts.push("");

  if (input.investigate.ok) {
    const r = input.investigate.result;
    parts.push("## Root cause");
    parts.push("");
    parts.push(r.rootCause.trim() || "(no root cause given)");
    parts.push("");

    parts.push("## Files implicated");
    parts.push("");
    if (r.filesImplicated.length === 0) {
      parts.push("_None identified._");
    } else {
      for (const f of r.filesImplicated) {
        const range = f.lineRange ? `:${f.lineRange[0]}–${f.lineRange[1]}` : "";
        parts.push(`- \`${f.path}${range}\``);
      }
    }
    parts.push("");

    parts.push("## Proposed fix");
    parts.push("");
    parts.push(r.proposedFix.trim() || "(no proposed fix)");
    parts.push("");

    if (r.specsReferenced.length > 0) {
      parts.push("## Specs touched");
      parts.push("");
      for (const s of r.specsReferenced) parts.push(`- \`specs/${s}.md\``);
      parts.push("");
    }

    parts.push("## Risks / unknowns");
    parts.push("");
    parts.push(r.notes.trim() || "_None recorded._");
    parts.push("");

    parts.push("## Triage signals");
    parts.push("");
    parts.push(`- fixKnown: \`${r.fixKnown}\``);
    parts.push(`- confidence: \`${r.confidence}\``);
    if (r.noBugFound) parts.push(`- noBugFound: \`true\``);
    parts.push("");
  } else {
    parts.push("## Triage signals");
    parts.push("");
    parts.push(`Investigate agent did not produce a parseable result: \`${input.investigate.error}\`.`);
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Append a structured "Attempt N failure" section to an existing handoff.
 * Returns the new full body so callers can rewrite the file.
 */
export function appendAttemptFailure(
  existing: string,
  attemptNumber: number,
  ciOutputTail: string,
  extraNotes?: string,
): string {
  const parts: string[] = [];
  parts.push(existing.trimEnd());
  parts.push("");
  parts.push(`## Attempt ${attemptNumber} failure`);
  parts.push("");
  parts.push("```");
  parts.push(ciOutputTail.trim());
  parts.push("```");
  if (extraNotes) {
    parts.push("");
    parts.push(extraNotes.trim());
  }
  parts.push("");
  return parts.join("\n");
}

/** Read an existing handoff.md (if present) from a directory. Returns null if not found. */
export async function readHandoff(dir: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(dir, "handoff.md"), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Write handoff.md to a directory. */
export async function writeHandoff(dir: string, body: string): Promise<string> {
  const p = path.join(dir, "handoff.md");
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body, "utf-8");
  return p;
}

/** Validate that a parsed InvestigateResult has the minimum information needed for a useful handoff.
 *  Returns null if OK, or a string describing what's missing. */
export function validateForHandoff(r: InvestigateResult): string | null {
  if (!r.fixKnown) return "investigate.fixKnown is false — handoff would be incomplete";
  if (!r.rootCause.trim()) return "investigate.rootCause is empty";
  if (!r.proposedFix.trim()) return "investigate.proposedFix is empty";
  return null;
}
