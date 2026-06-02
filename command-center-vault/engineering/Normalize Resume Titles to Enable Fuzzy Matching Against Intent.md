---
pillar: engineering
title: Normalize Resume Titles to Enable Fuzzy Matching Against Intent
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - fuzzy-matching
  - data-normalization
  - resume-parsing
---

Extract and normalize job titles from resume as a canonical list; fuzzy-match against user's intent to ground suggestions and reduce false negatives.

rolenext extracts job titles from the user's resume to suggest relevant search intents. Exact matching would be brittle: "Senior Software Engineer" and "Sr. SWE" and "Principal Engineer" are variations. The system normalizes extracted titles (canonicalize case, strip qualifiers, deduplicate) and uses fuzzy matching to compare against the user's current search input. This avoids missing suggestions when the user types a variant or abbreviation.
