---
pillar: engineering
title: Biome as single-tool linter+formatter
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - biome
  - linting
  - formatting
  - tool-selection
  - typescript
aliases:
  - ESLint alternative
  - Prettier replacement
  - formatter
---

Biome 2.x replaces ESLint+Prettier; Rust-based, ~100x faster, handles both linting and formatting in one tool.

RoleNext chose Biome 2.x over ESLint+Prettier for the frontend. Biome is Rust-based and roughly 100x faster, replaces both tools with a single config (biome.json), and the React/TS/Vite stack is well-supported. Plugin ecosystem gap is irrelevant when TypeScript catches most linting issues already. Single tool means one config file, one command to run, no bridging between separate linters and formatters.


## Related

- [[Biome rules disabled for project context]]
