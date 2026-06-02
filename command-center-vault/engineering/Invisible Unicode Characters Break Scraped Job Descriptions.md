---
pillar: engineering
title: Invisible Unicode Characters Break Scraped Job Descriptions
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - unicode
  - scraping
  - parsing
  - data-cleaning
---

Job descriptions from sources like Walmart/ZipRecruiter contain invisible control characters (U+200E, U+200B–200F, U+2028–2029, U+FEFF) that render as empty bullet points in the UI.

When parsing HTML job descriptions, invisible Unicode control characters—particularly U+200E (LEFT-TO-RIGHT MARK)—appear as spacers in the original source but become line-only strings after plaintext conversion. The parsing pipeline trims lines and checks for empty strings, but trim() only removes ASCII whitespace, so invisible characters pass through. The fix: strip characters in the ranges U+200B–200F, U+2028–2029, and U+FEFF at parse time. This came up in RoleNext when Walmart job descriptions sourced via ZipRecruiter rendered as visual gaps in the job details.


## Related

- [[Unicode Cleanup Needs Both Parse Paths]]
