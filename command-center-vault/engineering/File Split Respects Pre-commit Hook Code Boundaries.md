---
pillar: engineering
title: File Split Respects Pre-commit Hook Code Boundaries
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - code-organization
  - modularity
---

When a handler exceeds the pre-commit line-count limit, split by responsibility rather than resizing the limit.

RoleNext's support handler grew to 409 lines before the pre-commit hook enforced a 400-line limit. Instead of raising the limit, the handler was split into focused files: handler.go (types/constructor), feedback.go (feedback submission), bug_report.go (screenshot upload), sanitize.go (MIME validation/EXIF stripping). Natural boundaries emerged from responsibility separation, and each file landed well under the limit. This pattern respects infrastructure constraints as signals to refactor rather than exceptions to bypass.
