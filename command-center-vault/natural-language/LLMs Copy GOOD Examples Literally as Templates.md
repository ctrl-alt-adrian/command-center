---
pillar: natural-language
title: LLMs Copy GOOD Examples Literally as Templates
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - prompt-engineering
  - examples
  - pattern-learning
aliases:
  - examples-as-templates
  - literal-imitation
---

When providing example answers in prompts, LLMs copy them as literal templates rather than extracting the underlying pattern.

In the RoleNext interview generator project, the initial approach was to show GOOD vs. BAD example answers in the prompt: 'BAD: Describe a time you handled a challenge. GOOD: Open with the specific clinical scenario.' But the LLM didn't learn to generate novel answers following that pattern. It copied the examples directly instead. The fix was to replace positive examples with explicit anti-repetition rules: 'Avoid generic openings,' 'Each answer should reflect different situations.' This shift from templates to constraints improved output diversity and reduced scripted repetition. The lesson: when you want pattern-following, rules beat examples.


## Related

- [[Anti-Repetition Rules Beat Positive Examples in Prompts]]
