---
pillar: engineering
title: go vet in go.work Monorepos Requires Module-Specific Paths
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - go
  - monorepo
  - tooling
  - go.work
aliases:
  - go.work path resolution
  - go vet with workspaces
---

Running go vet with ./... at the workspace root fails in a go.work monorepo; you must cd into the specific module directory before running.

A go.work file registers multiple module directories (for example, backend/, cli/, openspec/) as a workspace. When go vet is run from the workspace root with ./... or ./something, Go's path resolution doesn't match modules listed in go.work—it only resolves from the current directory. Pre-commit hooks that run go vet across the entire monorepo fail unless they cd into the specific module first. Hardcoding cd "$PROJ_ROOT/backend" in the hook is simpler and sufficient for a stable workspace structure than trying to parse go.work dynamically.
