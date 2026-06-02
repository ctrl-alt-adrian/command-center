---
pillar: engineering
title: Centralized Query Key Factory Reduces Brittleness and Duplication
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react-query
  - query-keys
  - maintainability
  - deduplication
aliases:
  - query-key-factory
  - centralized-keys
  - querykeys-pattern
---

Extract all query keys into a single factory instead of scattering raw strings across 13 files.

RoleNext replaced 26 raw query key strings across 13 files with a centralized factory in lib/queryKeys.ts. Raw strings like 'jobs' appear in useQuery calls, useMutation invalidations, and test mocks, but changes are hard to track and renaming is error-prone. The factory pattern groups related keys: const keys = { jobs: { all: () => ['jobs'], detail: (id) => ['jobs', id] }, users: {...} } and exposes a single interface. Invalidations become keys.jobs.all() instead of ['jobs'], making refactoring safer and test brittleness less likely. TanStack Query's documentation names this as a core pattern for medium-to-large apps.
