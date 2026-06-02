---
pillar: engineering
title: Automated Audits Require Verification Against Codebase
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - auditing
  - verification
  - pre-launch
  - process
---

Automated audit agents produce findings that need verification against actual source code.

RoleNext ran a 4-agent pre-launch audit covering security, infrastructure, UX, and testing. Initial findings looked credible: 'secrets committed in git', 'CSP missing', 'XSS in formatDescription'. A verification pass checking each finding against the actual codebase removed 8 false positives. Automated agents can hallucinate or miss context. Before acting on audit findings, verify against the source of truth to eliminate false positives.
