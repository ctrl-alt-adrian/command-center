# Session Summarize Prompt

Used by the session-end hook. Model: haiku (fast, cheap).

## Prompt

```
Summarize this coding session for a knowledge base that feeds a marketing content pipeline.

Extract:

1. **What was built/changed** - specific features, fixes, or refactors
2. **Key learnings** - technical insights, patterns discovered, gotchas encountered
3. **Decisions made** - architectural choices, trade-offs, why one approach was chosen over another
4. **Interesting problems solved** - anything non-obvious that someone else might find valuable

For the frontmatter:

- **summary**: One sentence describing the session. Be specific (not "worked on project").
- **tags**: 3-6 lowercase tags covering the tech, domain, and concepts touched.
- **contentAngles**: Which of these apply to this session (pick all that fit):
  - `technical-insight` - a non-obvious pattern, gotcha, or technique
  - `problem-solution` - a specific bug or challenge with a clear fix
  - `building-in-public` - progress on a product someone could follow along with
  - `product-decision` - a design or architecture choice driven by user needs
  - `founder-story` - challenges, wins, or lessons from building a product
- **shareworthy**: true if the session has something genuinely interesting to share publicly. false if it's routine internal work (config, dependency updates, minor refactors). Be honest — not every session is worth a post.

Output as YAML frontmatter + markdown body. Example:

---
date: 2026-04-09
project: rolenext
summary: Built timed interview prep mode with countdown timer, discovered setInterval drift bug
tags: [react, testing, ux, interview-prep]
contentAngles: [problem-solution, building-in-public, technical-insight]
shareworthy: true
usedForContent: false
---

## What was built
- Added timed interview prep test mode with configurable question counts

## Key learnings
- React useReducer is cleaner than useState for complex multi-step form state

## Decisions
- Chose countdown timer over progress bar - users reported time pressure helps simulate real interviews

## Interesting problems
- Had to debounce answer submissions because rapid clicking caused race conditions with the scoring API
```
