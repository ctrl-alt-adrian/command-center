---
pillar: natural-language
title: Missing Skills as Fabrication Guardrail
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - prompt-engineering
  - constraints
  - resume-optimization
---

Frame missing skills as constraints (do NOT add) rather than requirements (address these) to prevent hallucination while maintaining anti-fabrication guardrails.

When optimizing resumes, the optimizer needs to know which skills the candidate lacks to avoid fabricating experience. The naive approach makes this a positive requirement: the LLM must address or acknowledge every missing skill. This creates noise—entries like 'Missing Skills - Angular: acknowledged that Angular is not present on this resume.' A better framing: treat missing skills as a boundary constraint. Tell the LLM 'do NOT add java, python, golang if not on the resume.' This preserves the anti-hallucination guardrail without forcing the LLM to generate filler. The difference is subtle but critical: obligation generates noise; boundaries are silent unless violated.
