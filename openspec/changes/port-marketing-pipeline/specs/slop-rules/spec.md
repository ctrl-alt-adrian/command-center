## ADDED Requirements

### Requirement: Slop rules ship as YAML rule packs

The system SHALL store slop detection rules as YAML files under `pipelines/marketing/slop-rules/`. Each rule SHALL declare an `id`, a `pattern` (regex), a `severity` (`block` or `warn`), and a human-readable `message`. The slop engine SHALL load all rule files at startup and expose `runRules(text)` returning the array of violations.

#### Scenario: A draft contains a blocking pattern

- **WHEN** a draft contains the string "delve into" and the corresponding rule has `severity: block`
- **THEN** `runRules` returns a violation with that rule's id and message

#### Scenario: A new rule is added

- **WHEN** a new `.yaml` file is dropped into `slop-rules/`
- **THEN** the next slop-check run includes it without code changes

### Requirement: Slop engine is domain-agnostic; rule packs are pipeline-scoped

The core slop engine SHALL NOT import marketing-specific files. The marketing pipeline SHALL register its rule pack at startup via the pipeline config. Other pipelines (e.g. vault-nuggets in phase 3, reddit-pmf in phase 5) MAY register their own packs without conflict.

#### Scenario: Two pipelines register separate rule packs

- **WHEN** marketing registers `marketing-rules` and another pipeline registers `nuggets-rules`
- **THEN** each pipeline's slop check runs only against its own rule pack
