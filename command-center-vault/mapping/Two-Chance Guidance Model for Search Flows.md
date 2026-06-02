---
pillar: mapping
title: Two-Chance Guidance Model for Search Flows
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - search
  - ux
  - guidance
  - orchestration
---

Provide search guidance at two moments in the flow: before search (inline hints) and after results (refinement suggestions). Doubles the odds of helping the user.

The search intent feature guides users at two points: pre-search, when keystroke analysis detects a weak or broad query, hints appear under the input; post-search, when result analysis shows low intent confidence, a refinement card surfaces above results. Both triggers are automatic (debounce at 400ms), so users never hunt for the feature. The two-chance model acknowledges that users need different help at different moments: pre-search input helps them formulate better queries; post-search refinement helps them interpret what they got. Applicable anywhere guidance can improve a multi-step flow.


## Related

- [[Visible-by-Default Beats Tab-Gated Discovery]]
