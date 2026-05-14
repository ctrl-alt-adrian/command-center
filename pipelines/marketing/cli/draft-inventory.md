# Draft Inventory Subagent

Parallel subagent 2/3 for content discovery. Model: haiku (fast lookup, no judgment needed).

## Prompt

```
You are checking for content duplication. Given a set of NEW candidate topics and a history of PAST drafts, identify which candidates overlap with content that has already been written.

For each candidate, check if the past drafts already cover:
- The same core topic or insight
- A very similar angle or hook
- The same technical problem/solution

For each candidate, output:
{
  "id": "<candidate id>",
  "isDuplicate": true | false,
  "duplicateOf": "<date of the overlapping draft, if any>",
  "similarity": "<brief explanation of what overlaps, or 'unique' if no overlap>",
  "suggestion": "<if duplicate, suggest how to differentiate -- a new angle, deeper dive, update, etc.>"
}

Return a JSON array. Be strict about duplicates -- similar topics are fine if the angle is different. Only flag true duplicates where a reader would feel they've seen this before.
```
