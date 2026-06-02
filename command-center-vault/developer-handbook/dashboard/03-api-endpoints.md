# Dashboard 03 — API Endpoints

> Every `+server.ts` under `dashboard/src/routes/api/` is a JSON endpoint. They are the **entire mutation surface** of the dashboard — there are no form actions ([02 §5](./02-routing-and-loads.md#5--no-form-actions--mutations-go-through-fetch-to-api-routes)). Each one is a thin wrapper: validate the request, call **one core or pipeline function**, return its result as JSON. This page catalogues all 24 of them.

> Official docs: [SvelteKit routing — `+server.ts`](https://svelte.dev/docs/kit/routing#server).

---

## 1. Shared conventions

Read these once; they apply to almost every endpoint below.

- **`json` / `error` from `@sveltejs/kit`.** Success returns `json(payload)`; failures `throw error(status, message)`, which SvelteKit turns into an HTTP error response.
- **Tolerant body parsing.** Bodies are read with `await request.json().catch(() => ({}))` so a missing/empty/garbage body degrades to `{}` instead of throwing. Then individual fields are type-checked.
- **Status codes.** `400` = bad/missing input; `404` = unknown task/pipeline/file; `409` = conflict — specifically *"cannot approve past a failed deterministic gate"* (see [`/api/tasks/[id]/approve`](#post-apitasksidapprove)).
- **The engine is the source of truth.** Endpoints don't hold state; they delegate to `core/lib/*` (mostly `processor.ts` and `tasks.ts`) or to a `pipelines/*/lib/*` module. The functions they call are documented in [`../core/03-processor.md`](../core/03-processor.md) and [`../core/05-task-store.md`](../core/05-task-store.md).
- **No auth.** `hooks.server.ts` `handle` is a pass-through ([01 §6](./01-stack-and-bootstrap.md#6--server-bootstrap--hooksserverts-the-critical-bit)); endpoints are open on localhost.

---

## 2. The heartbeat — `POST /api/cron`

`api/cron/+server.ts` — **the single most important endpoint.** This is what the OS cron hits to make the engine *do work*. One POST = one processor tick.

```ts
import { json } from "@sveltejs/kit";
import { runProcessor } from "../../../../../core/lib/processor.ts";

export async function POST() {
  const result = await runProcessor();
  return json(result);
}
```

| | |
|---|---|
| **Method / path** | `POST /api/cron` |
| **Body** | none |
| **Calls** | `runProcessor()` (`core/lib/processor.ts`) |
| **Returns** | the `ProcessorResult` (processed / deferred counts etc.) |
| **Callers** | OS cron (the real heartbeat) **and** the "run /api/cron" button on `/tasks`, **and** the vault-staging "Embed approved" flow which POSTs `/api/cron` right after approving |

Without a tick (cron or button), nothing advances: `load`s read state, but only `runProcessor()` executes `pending` tasks. See [04 — Full-stack trace §heartbeat](./04-full-stack-trace.md).

---

## 3. Tasks — collection endpoints

### `GET /api/tasks` · `POST /api/tasks`
`api/tasks/+server.ts`

| Method | Body | Calls | Returns |
|---|---|---|---|
| `GET` | — | `listTasks()` | `{ tasks }` |
| `POST` | `{ pipelineId, input? }` | `getPipeline()` then `createTask()` | `{ task }` |

`POST` validates `pipelineId` is a non-empty string (`400` otherwise), 404s on unknown pipeline, then creates a task **at the pipeline's first phase**: `phaseId: pipeline.phases[0].id`, `input: body.input ?? {}`.

### `GET /api/tasks/[id]` · `DELETE /api/tasks/[id]`
`api/tasks/[id]/+server.ts`

| Method | Calls | Returns |
|---|---|---|
| `GET` | `getTask(id)` → `404` if absent | `{ task }` |
| `DELETE` | `getTask(id)` (404-guard) then `deleteTask(id)` | `{ removed: id }` |

### `POST /api/tasks/clear`
`api/tasks/clear/+server.ts` — bulk **delete** tasks by status.

- **Body:** `{ status?: TaskStatus | TaskStatus[], pipelineId? }`. Defaults to `["failed"]` when `status` is omitted (so an accidental empty body can't nuke in-flight work).
- **Allowlist:** only `"failed" | "completed" | "cleared_stale"` may be cleared — any other status → `400`.
- **Calls:** `listTasks()` → filter by status (+ optional pipeline) → `deleteTask()` each.
- **Returns:** `{ removed, ids, filter }`.

### `POST /api/tasks/clear-failures`
`api/tasks/clear-failures/+server.ts` — **does not delete tasks.** It strips `error` and `gate_fail` entries from each task's `attempts` log so the Failures panel goes quiet, while preserving `ok` attempts and leaving status untouched.

- **Body:** `{ pipelineId? }`.
- **Calls:** `listTasks()` → filter to tasks that have any error/gate_fail attempt → `clearFailureAttempts(id)` each.
- **Returns:** `{ cleared, attemptsRemoved, ids, filter }`.
- Use `rerun` / `rerun-gate` to actually re-run; this just clears the *record*.

### `POST /api/tasks/rerun`
`api/tasks/rerun/+server.ts` — re-queue every `failed` task.

- **Body:** `{ pipelineId? }`. Targets `status === "failed"` (+ optional pipeline).
- **Calls:** `rerunTask(id)` each — flips → `pending`, clears error, resets `retryCount`.
- **Returns:** `{ rerun, ids, filter }`.

### `POST /api/tasks/rerun-gate`
`api/tasks/rerun-gate/+server.ts` — bulk re-run **deterministic gates** that exhausted their retry budget.

- **Body:** `{ pipelineId?, phaseId? }` (e.g. `phaseId: "slop-check"`).
- **Targets:** `status === "needs_review"` **and** non-empty `gateFailReason` (+ optional pipeline/phase).
- **Calls:** `rerunGate(id)` each.
- **Returns:** `{ rerun, ids, filter }`.

### `POST /api/tasks/approve`
`api/tasks/approve/+server.ts` — bulk-approve everything in `needs_review`.

- **Body:** `{ pipelineId? }`.
- **Calls:** `approveTask(id)` each, in a `try/catch` so one gate-blocked task doesn't abort the batch.
- **Returns:** `{ approved, failedCount, ids, failed: [{id, reason}], filter }` — gate-blocked tasks land in `failed[]` with their reason rather than 409-ing the whole request.

### `POST /api/tasks/resume`
`api/tasks/resume/+server.ts` — drain `paused_user` fan-out children back to `pending`.

- **Body:** `{ pipelineId?, count? }`. `count` defaults to `25`; must be a positive integer (`400` otherwise).
- **Calls:** `resumePausedUserTasks(pipelineId, count)` — flips the next N oldest `paused_user` tasks → `pending`.
- **Returns:** `{ ...result, filter: { pipelineId, count } }`.
- This is the "Resume next batch" control for `fanOutBatchSize`-gated pipelines (see [`../core/03-processor.md`](../core/03-processor.md)).

---

## 4. Tasks — single-task action endpoints

All under `api/tasks/[id]/…`, all `POST`, all 404 when the task is missing/ineligible. Each calls exactly one processor function.

### `POST /api/tasks/[id]/approve`
`api/tasks/[id]/approve/+server.ts` — advance a `needs_review` task to its next phase.

```ts
export async function POST({ params }) {
  try {
    const task = await approveTask(params.id);
    if (!task) throw error(404, "task not found or not in needs_review");
    return json({ task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("cannot approve past failed")) throw error(409, msg);
    throw err;
  }
}
```

> **The 409 case.** `approveTask()` *throws* when you try to approve past a **deterministic** gate that failed (the task carries a `gateFailReason`). This endpoint maps that specific thrown message to **HTTP 409 Conflict** — the only place 409 is used. The UI then offers "rerun gate" / "reject" instead of approve (see [05](./05-components-and-patterns.md)). Calls `approveTask(id)` (`core/lib/processor.ts`).

### `POST /api/tasks/[id]/reject`
`api/tasks/[id]/reject/+server.ts` — `rejectTask(id, body.reason)` → marks task `failed` with the reason. Body `{ reason? }`. 404 if not found.

### `POST /api/tasks/[id]/rerun`
`api/tasks/[id]/rerun/+server.ts` — `rerunTask(id)` → re-queue a single `failed` task. 404 if "not found or not in failed state".

### `POST /api/tasks/[id]/rerun-gate`
`api/tasks/[id]/rerun-gate/+server.ts` — `rerunGate(id)` → re-run one deterministic gate with a fresh retry budget. 404 if not found.

### `POST /api/tasks/[id]/disable`
`api/tasks/[id]/disable/+server.ts` — `disableTask(id)` → take a `pending` task out of the processor (reuses `paused_user`). 404 if not found.

### `POST /api/tasks/[id]/enable`
`api/tasks/[id]/enable/+server.ts` — `enableTask(id)` → return a disabled task to the `pending` queue. 404 if not found.

| Endpoint | Calls | 404 message |
|---|---|---|
| `/approve` | `approveTask` | "task not found or not in needs_review" (or 409 on gate block) |
| `/reject` | `rejectTask` | "task not found" |
| `/rerun` | `rerunTask` | "task not found or not in failed state" |
| `/rerun-gate` | `rerunGate` | "task not found" |
| `/disable` | `disableTask` | "task not found" |
| `/enable` | `enableTask` | "task not found" |

---

## 5. Task artifacts — `GET /api/tasks/[id]/files/[filename]`

`api/tasks/[id]/files/[filename]/+server.ts` — serves files written by a phase's `run()` (PDFs, markdown). Used by RoleNext job-apply (`resume.pdf`, `cover.pdf`, etc.). This is the most security-conscious endpoint — three guards against directory traversal:

1. **Filename allowlist** — only these are servable (`404` otherwise):
   ```ts
   const ALLOWED_FILES = new Set(["resume.pdf", "cover.pdf", "apply.md", "candidates.md", "review.md", "applied.md"]);
   ```
2. **`?phase=` is required** and must match `/^[a-z0-9-]+$/i` — else `400 "phase query param required (e.g. ?phase=prep)"`.
3. **Resolved-path containment check** — after building `path.join(taskDir(id), phaseId, filename)`, it re-resolves and confirms the result is still under the task dir:
   ```ts
   const resolved = path.resolve(filePath);
   if (!resolved.startsWith(path.resolve(taskDir(id)) + path.sep)) {
     throw error(400, "invalid file path");
   }
   ```

| | |
|---|---|
| **Method / path** | `GET /api/tasks/[id]/files/[filename]?phase=<phase>[&download=1]` |
| **Calls** | `getTask(id)` (404-guard), then `fs.readFile` under `taskDir(id)` |
| **Content-Type** | `.pdf` → `application/pdf`, `.md` → `text/markdown; charset=utf-8`, else `application/octet-stream` |
| **`?download=1`** | adds `content-disposition: attachment; filename="…"` to force a download |
| **Returns** | raw file bytes (`Response`), or `404` if the file isn't on disk |

---

## 6. Pipelines — `/api/pipelines/[id]/enabled`

`api/pipelines/[id]/enabled/+server.ts` — read/write a pipeline's enabled flag (persisted by `core/lib/pipelineState.ts`; a disabled pipeline is skipped by the processor).

| Method | Body | Calls | Returns |
|---|---|---|---|
| `GET` | — | `isPipelineEnabled(id)` | `{ id, enabled }` |
| `POST` | `{ enabled: boolean }` (required, else `400`) | `getPipeline()` (404-guard) then `setPipelineEnabled(id, enabled)` | `{ id, enabled }` |

Backs the per-pipeline toggle switch on `/tasks` (the `togglePipeline` function, [05](./05-components-and-patterns.md#toggle-switches)).

---

## 7. Marketing endpoints

### `GET/POST /api/marketing/platforms`
`api/marketing/platforms/+server.ts` — read/write which social platforms are enabled. Calls `getPlatformConfig()` / `setDisabledPlatforms()` from `pipelines/marketing/lib/config.ts`; `all` comes from `PLATFORMS` constant.

| Method | Body | Returns |
|---|---|---|
| `GET` | — | `{ enabled, disabled, all }` |
| `POST` | `{ disabled: string[] }` (must be array, else `400`) | `{ enabled, disabled }` |

### `PUT /api/marketing/drafts/[slug]/[platform]`
`api/marketing/drafts/[slug]/[platform]/+server.ts` — persist an edited draft. Body `{ content: string }` (else `400`). Calls `saveDraft(slug, platform, content)` (`pipelines/marketing/lib/drafts.ts`). Returns `{ ok: true }`.

### `POST /api/marketing/drafts/[slug]/[platform]/refine`
`api/marketing/drafts/[slug]/[platform]/refine/+server.ts` — **refine a draft with Claude (NOT persisted).**

- **Body:** `{ content: string, instruction: string }` — both required, non-empty (`400` otherwise).
- **Calls:** `claude(prompt, { model: "claude-sonnet-4-6", timeoutMs: 5*60*1000 })` (`core/lib/claude.ts`). The prompt is an inline template wrapping the current draft + the instruction, asking for *only* the revised post.
- **Returns:** `{ content: refined }` — the editor drops this into the textarea and marks it dirty; the user must still hit **Save** (the PUT above) to persist.

---

## 8. Personal-brand endpoints

Structurally identical to marketing's draft endpoints, against `pipelines/personal-brand/lib/`:

### `PUT /api/personal-brand/drafts/[slug]/[platform]`
`api/personal-brand/drafts/[slug]/[platform]/+server.ts` — `saveBrandDraft(slug, platform, content)`. Body `{ content: string }`. Returns `{ ok: true }`.

### `POST /api/personal-brand/drafts/[slug]/[platform]/refine`
`api/personal-brand/drafts/[slug]/[platform]/refine/+server.ts` — same Claude-refine contract as marketing, **but the prompt comes from a file**, not inline: it reads `refine-post.md` from `CLI_DIR` (cached after first read), `replaceAll("{{platform}}", params.platform)`, appends the current draft + instruction. Same model `claude-sonnet-4-6`, same 5-minute timeout. Returns `{ content }`, not persisted.

---

## 9. Vault staging endpoints

### `POST /api/vault/staging/[task]/[file]`
`api/vault/staging/[task]/[file]/+server.ts` — record an approve/reject decision on one staged candidate.

- **Body:** `{ status: "approved" | "rejected" }` (else `400`).
- **Calls:** `recordCandidateDecision(params.task, decodeURIComponent(params.file), status)` (`pipelines/vault-nuggets/lib/extract.ts`).
- **Returns:** `{ ok: true }`.

### `POST /api/vault/staging/[task]/bulk`
`api/vault/staging/[task]/bulk/+server.ts` — bulk-decide candidates in one request.

- **Body:** `{ action: "approve-pending" | "reject-pending" | "approve-all" | "reject-all" }` (else `400`).
- **Semantics:** `*-pending` only touches candidates with no decision yet; `*-all` overrides existing decisions too. `approve*` → `"approved"`, `reject*` → `"rejected"`.
- **Calls:** `listStagedCandidates(task)` → filter → `recordCandidateDecision()` each.
- **Returns:** `{ updated, status }`.

---

## 10. Full endpoint index

| Method(s) | Path | Core/pipeline fn |
|---|---|---|
| `POST` | `/api/cron` | `runProcessor` |
| `GET` `POST` | `/api/tasks` | `listTasks` · `getPipeline`+`createTask` |
| `GET` `DELETE` | `/api/tasks/[id]` | `getTask` · `deleteTask` |
| `POST` | `/api/tasks/clear` | `listTasks`+`deleteTask` |
| `POST` | `/api/tasks/clear-failures` | `listTasks`+`clearFailureAttempts` |
| `POST` | `/api/tasks/rerun` | `rerunTask` (bulk) |
| `POST` | `/api/tasks/rerun-gate` | `rerunGate` (bulk) |
| `POST` | `/api/tasks/approve` | `approveTask` (bulk) |
| `POST` | `/api/tasks/resume` | `resumePausedUserTasks` |
| `POST` | `/api/tasks/[id]/approve` | `approveTask` (→409 on gate block) |
| `POST` | `/api/tasks/[id]/reject` | `rejectTask` |
| `POST` | `/api/tasks/[id]/rerun` | `rerunTask` |
| `POST` | `/api/tasks/[id]/rerun-gate` | `rerunGate` |
| `POST` | `/api/tasks/[id]/disable` | `disableTask` |
| `POST` | `/api/tasks/[id]/enable` | `enableTask` |
| `GET` | `/api/tasks/[id]/files/[filename]` | `getTask` + guarded `fs.readFile` |
| `GET` `POST` | `/api/pipelines/[id]/enabled` | `isPipelineEnabled` · `setPipelineEnabled` |
| `GET` `POST` | `/api/marketing/platforms` | `getPlatformConfig` · `setDisabledPlatforms` |
| `PUT` | `/api/marketing/drafts/[slug]/[platform]` | `saveDraft` |
| `POST` | `/api/marketing/drafts/[slug]/[platform]/refine` | `claude` (not persisted) |
| `PUT` | `/api/personal-brand/drafts/[slug]/[platform]` | `saveBrandDraft` |
| `POST` | `/api/personal-brand/drafts/[slug]/[platform]/refine` | `claude` (file prompt, not persisted) |
| `POST` | `/api/vault/staging/[task]/[file]` | `recordCandidateDecision` |
| `POST` | `/api/vault/staging/[task]/bulk` | `listStagedCandidates`+`recordCandidateDecision` |

---

### Cross-links

- [04 — Full-stack trace](./04-full-stack-trace.md) — how a button click reaches these and back.
- [`../core/03-processor.md`](../core/03-processor.md) — `runProcessor`, `approveTask`, `rerunGate`, fan-out.
- [`../core/05-task-store.md`](../core/05-task-store.md) — `listTasks`, `getTask`, `createTask`, `deleteTask`.
- [05 — Components & patterns](./05-components-and-patterns.md) — the buttons that call these.
