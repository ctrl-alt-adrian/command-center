---
pillar: engineering
title: Edit vs. Write Asymmetry for Debug Statement Detection
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - implementation
---

Edit tool compares old vs. new for debug statements; Write tool scans the entire file.

The check-debug-statements hook uses different logic for Edit vs. Write. For Edit, compare console.log counts between old_string and new_string—only block if new content introduces MORE debug statements. This prevents false positives when old_string must include surrounding code that contains an existing log statement. For Write, scan the entire file since all content is new. The asymmetry avoids blocking edits to existing code while catching new violations.


## Related

- [[Mechanical Enforcement for Forgotten Code Quality Rules]]
