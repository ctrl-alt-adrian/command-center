# Find Content Prompt

Used by the daily cron job. Model: opus (needs judgment).

## Prompt

```
Search the ENTIRE knowledge base for entries that haven't been used for content yet (usedForContent: false or used_for_content: false).

You are finding content for Adrian, the founder building rolenext -- an interview prep platform. Content should build his audience and position rolenext as the go-to tool for interview preparation.

Evaluate every unused entry for TWO types of content:

### Type 1: Technical insight post
Look for:
- A non-obvious technical insight or pattern
- A relatable problem with a clear fix and outcome
- A decision or trade-off that other developers face
- A "TIL" moment that saves someone else time

For technical problems, the post MUST follow this structure:
- THE PROBLEM: What went wrong, what was observed, why it matters
- THE FIX: What specifically solved it (code pattern, approach, tool)
- WHAT THIS SOLVES: The concrete outcome -- faster, more reliable, fewer bugs, etc.

### Type 2: Product marketing post
Look for entries that relate to rolenext or interview prep that could become:
- A "building in public" story (what was built, why, what was learned)
- A product insight (a feature decision driven by user feedback or data)
- An industry observation about hiring, interviews, or career growth
- A founder story (challenges, wins, behind-the-scenes of building a product)

These posts should feel authentic, not salesy. Show the work, share the thinking.

### Skip entries that are:
- Routine refactoring with no insight
- Purely internal config/infra changes with nothing relatable
- Already used for content

### For each worthy entry, output:
- The KB entry ID (filename)
- Content type: "technical" or "marketing"
- A one-line hook (the core insight in plain language)
- Suggested angle for social content
- If technical: one-line each for PROBLEM, FIX, and OUTCOME
- If marketing: the narrative thread to pull on
- Relevant tags

Prioritize variety -- if the last few posts were technical, lean toward marketing, and vice versa. Surface up to 3 candidates, ranked by shareability. If nothing is worth sharing, say so. Do not force content.
```
