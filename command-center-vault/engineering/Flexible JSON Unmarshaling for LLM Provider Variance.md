---
pillar: engineering
title: Flexible JSON Unmarshaling for LLM Provider Variance
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - llm-integration
  - json-parsing
  - provider-variance
  - robustness
  - unmarshaling
aliases:
  - LLM Output Format Tolerance
  - Flex Int Type Pattern
---

Different LLM providers return inconsistent JSON formats (int vs string vs quoted float). Use a custom type with flexible unmarshaling that accepts all variants and normalizes to a single Go type.

Groq returned `"coreRequirementScore": "85"` (string), while other providers returned `"coreRequirementScore": 85` (int). Rather than trying to force consistency upstream (hopeless with multiple providers), build a `flexInt` type that implements `UnmarshalJSON` and accepts: integers, quoted integers, quoted floats, null, and empty string, converting all to int. Apply this pattern to any LLM-output field that might vary across providers. Pair with prompt skeleton changes: use `"coreRequirementScore": 0` instead of `"coreRequirementScore": "<0-100: ...>"` to nudge the LLM away from string output. The combination of flexible input parsing and prompt guidance makes the integration resilient to provider variance.


## Related

- [[Silent Truncation in Analyzer Pipeline]]
