---
pillar: engineering
title: Validation Mechanisms Create Obligation, Which Generates Noise
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - validation
  - error-handling
  - prompt-design
---

Validators that require positive output for every input case force the LLM to generate filler entries and cascading errors.

The resume optimizer had a coverage validator that forced the LLM to address or acknowledge every missing skill gap. When a skill genuinely wasn't on the resume and couldn't be naturally incorporated, the LLM fabricated filler: 'Acknowledged that Angular is not present.' When even filler failed validation, the request returned a 500. The fix was to remove the validation entirely. The pattern: validation rules that require positive output create an obligation, forcing the LLM to generate content that doesn't represent actual changes. If validation exists, make it optional or reframe the rule as a negative constraint: instead of 'address all gaps,' use 'do not fabricate skills.' Remove or simplify validators that measure completeness of a bad mechanism.
