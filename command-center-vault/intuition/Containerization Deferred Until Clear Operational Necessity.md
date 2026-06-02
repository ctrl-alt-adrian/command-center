---
pillar: intuition
title: Containerization Deferred Until Clear Operational Necessity
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - infrastructure
  - decision-making
---

Don't containerize infrastructure until there's operational pressure; theoretical always-on doesn't justify the cost.

Marketing-pipeline evaluated containerizing the pipeline worker for always-on cron scheduling. Decision: deferred. Reasoning: the knowledge base source lives on the user's local machine, Claude CLI auth requires keychain access (not available in containers), and publications are copy-pasted manually. No operational benefit to containerizing until the pipeline actually needs to run without the laptop. Build for real constraints, not hypothetical ones.
