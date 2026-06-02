---
pillar: engineering
title: Unicode Tokenizer Artifacts in LLM Output
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - tokenizer
  - unicode
  - llm
  - quality
  - parsing
aliases:
  - Unicode dashes from tokenizer
---

Language models emit Unicode dash variants (non-breaking hyphen U+2011, en dash U+2013) that the tokenizer produces. The model can't control this. String replacement before validation is the guaranteed fix.

When an LLM generates text, the tokenizer converts token IDs back to strings. For dashes, it often picks Unicode variants like U+2011 (non-breaking hyphen) or U+2013 (en dash) instead of ASCII. The model has no control over which variant appears; it's determined at tokenization time. When you parse or validate the output, these Unicode variants break downstream tools or look wrong to human eyes. In RoleNext's resume optimizer, this caused generated content to fail quality checks. Prompting the model to use ASCII hyphens doesn't work because the model isn't making the choice. The fix: use strings.NewReplacer to swap U+2011 and U+2013 for ASCII before any validation step. Zero additional LLM calls, guaranteed to converge.
