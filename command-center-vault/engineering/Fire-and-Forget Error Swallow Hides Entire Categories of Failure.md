---
pillar: engineering
title: Fire-and-Forget Error Swallow Hides Entire Categories of Failure
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - error-handling
  - anti-pattern
  - observability
---

Silent `.catch(() => {})` blocks hide failures and should be replaced with error logging at minimum.

Marketing-pipeline had persistent silent failures because promise chains ended with `.catch(() => {})` with no logging. This pattern appeared in multiple call sites: api/tasks/run, api/tasks/[id] regenerate, processor.ts runPipeline, and processor.ts discover. The failures were invisible for weeks because there was no signal at the call site. Replace every `.catch(() => {})` with a logError() call capturing source, task ID, and stage context. You need to know a failure happened; silent swallows guarantee you won't.
