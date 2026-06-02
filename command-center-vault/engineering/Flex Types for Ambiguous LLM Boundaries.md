---
pillar: engineering
title: Flex Types for Ambiguous LLM Boundaries
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - type-design
  - llm-output
  - schema
  - json
aliases:
  - flex_int pattern
  - type tolerance
---

Custom JSON types that accept multiple input formats centralize type handling at data boundaries, eliminating scattered runtime type checks.

When LLMs output structured data, consistency is not guaranteed—scores might arrive as JSON strings ("123") or numbers (123). Rather than defensive type assertions throughout the codebase, define a flexible type with a custom UnmarshalJSON that handles both cases. The rolenext job analyzer uses flex_int: a type that unmarshals either format and normalizes to int internally. This approach keeps caller code readable, makes the edge case explicit in schema, and avoids the fragility of runtime type guards at every call site.
