---
pillar: engineering
title: Resolver Fallback Chains Hide Test Failures
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - fallback-chains
  - integration-testing
aliases:
  - fallback chain brittleness
---

Unit tests can pass while fallback chains fail in real usage because tests don't exercise the full chain.

Mirukai removed HiAnime as a scraper source and unit tests passed. Playback failed because the resolver's fallback chain now had a gap that integration tests missed. The Jikan + AnimeGG chain worked in isolation, but removing one link broke the end-to-end path that users hit. When you remove a step from a fallback chain, run tests that exercise the full chain end-to-end. Unit-level tests on individual scrapers don't catch the cascade.
