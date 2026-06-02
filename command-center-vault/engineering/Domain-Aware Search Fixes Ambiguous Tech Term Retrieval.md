---
pillar: engineering
title: Domain-Aware Search Fixes Ambiguous Tech Term Retrieval
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - search
  - youtube
  - relevance
---

Searching 'Snowflake' alone returns paper craft videos; prepending domain context yields the right results.

In RoleNext's video search, querying 'Snowflake' returned irrelevant results because YouTube couldn't disambiguate the database product from winter crafts. The fix: thread domain context from skill gap explanations through the search handler. Instead of `SearchVideos(displayName, "")`, pass domain like 'Data Engineering' so the query becomes 'Snowflake for Data Engineering tutorial'. This pattern applies to any search on ambiguous terms (Python for snakes vs. programming, Django for web framework vs. the name, etc.). The domain metadata is often upstream already; the gain is threading it to the search layer.
