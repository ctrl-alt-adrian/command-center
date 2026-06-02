---
pillar: mapping
title: Lock Design Workflow After First Successful Handoff
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - design-system
  - workflow
  - handoff
  - claude-design
aliases:
  - design handoff template
  - locked implementation process
---

Establish a repeatable process: Claude Design produces mocks first, then implementation follows a proven template (one surface per PR, parallel backend/data/components, integration by you).

After shipping the editorial dashboard redesign (PR #212), the user locked a workflow for the remaining app redesigns. The pattern: all design work goes through Claude Design first, producing annotated mocks at /home/adrian/Downloads/Rolenext/design_handoff_*/. Implementation then follows the dashboard template: backend changes (new fields, helpers, tests), frontend data utility layer (computeDashboardData pattern), new UI components. Backend, data, and component tasks run in parallel via subagents; you do the final integration. This scales design consistency without a dedicated designer, using the first successful PR as the reference implementation for all subsequent surfaces.


## Related

- [[Computed Data Utility Hydrates API Response]]
- [[Global Primitives Restyle for Consistency]]
