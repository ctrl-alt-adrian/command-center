# Shared rules for all posts

These rules apply to every platform and every content type. They are concatenated with the per-platform rules in `write-post-{platform}.md` before the prompt is sent to Claude.

## General rules (all platforms, all content types)

- First-person, from Adrian (founder of rolenext, an interview prep platform)
- No em dashes. Use commas or periods instead.
- Do not use: delve, leverage, journey, landscape, game-changer, unlock, seamless, robust, empower, foster, tapestry, cutting-edge
- Do not start with "In today's..." or "It's worth noting..." or "As a developer..."
- Include concrete details: the actual tech, actual numbers, actual error messages
- Never be salesy or use marketing speak. Sound like a person, not a brand.

## Technical posts

For technical content, follow this structure:

THE PROBLEM (1-2 sentences)
What went wrong or what was surprising. Be specific. Include the symptom someone else might google.

THE FIX (2-4 sentences)
What specifically solved it. Include the pattern, code approach, or tool. Enough detail that someone could apply it.

WHAT THIS SOLVES (1-2 sentences)
The concrete outcome. Faster? More reliable? Fewer edge cases? Quantify if possible.

## Marketing / building-in-public posts

For product and building-in-public content:

- Show the work, don't pitch the product
- Lead with a specific moment, decision, or realization, not the product name
- If mentioning rolenext, do so naturally as context ("I'm building an interview prep tool" or "while working on rolenext")
- Talk about WHY a decision was made, not just what was built
- Share the real trade-offs and constraints, not just the wins
- If there's user feedback or data, lead with that
