---
pillar: engineering
title: Engineering — Map of Content
created: 2026-05-14
tier: 1
content_ready: false
tags: [map-of-content, engineering]
aliases: []
---

# Engineering

Code-level patterns: deterministic gates, file-based handoffs, backpressure, retry. The 'E' in MACHINE.

## Notes

- [[Wire Cache Cleanup to Shutdown Signal]]

- [[Design Indexes to Match Query Patterns]]

- [[Two-Tier Mux Routes Health Checks Around Auth]]

- [[Stacked PRs Orphan When Base Merges on GitHub]]

- [[Auto-Dismiss Toast Timing Varies by Feedback Type]]

- [[Singleton Store Preserves Async Feedback Across Route Navigation]]

- [[Testing HTTP Timeouts with Blocking Handlers]]

- [[JWKS Fetch Timeout]]

- [[URL Validation Whitelist Pattern]]

- [[Context-Based JWT Forwarding Over Service Tokens]]

- [[Explicit Blocking Markers on Checklists Clarify Dependency Status]]

- [[PDF Pipeline Bugs Span Multiple Layers]]

- [[Hidden Conventions Surface When Expanding Small Tasks]]

- [[Content Cleaning Should Be Explicit in Export Pipelines]]

- [[Font Glyph Coverage Is a Pipeline Blocker]]

- [[Empty PDF Detection Prevents Silent Upload Failures]]

- [[Hardcoded Colors Reveal Scattered Architecture]]

- [[Avatar State: Boolean Over Presence Check]]

- [[Theme Tokens Enable Accessibility Enforcement]]

- [[Dialog Component as Reusable Primitive]]

- [[Automated Audits Require Verification Against Codebase]]

- [[Hardcoded Color Migration: Exact Match vs Intentional Override]]

- [[Clerk Avatar Detection: hasImage vs imageUrl]]

- [[CSP Configuration for Third-Party Auth Systems]]

- [[Webhook Signature Verification Closes Trust Loop]]

- [[Direct Path Updates Over Symlinks for Maintainability]]

- [[Multipart Upload Size Limit With MaxBytesReader]]

- [[File Upload Validation With DetectContentType]]

- [[Environment Variable Shadowing in Shell]]

- [[Rate Limiter Bug: RemoteAddr Includes Port]]

- [[LLM Judge with Calibration for Content Quality]]

- [[Match SDK Versions to Webhook API Versions]]

- [[Use Real Auth Tokens in Integration Tests]]

- [[Job Cache with Time-to-Live Reduces Extraction Cost]]

- [[Dynamic Domain Context Scales Without Taxonomy]]

- [[ProgressSink Interface for Per-Source Progress]]

- [[useSyncExternalStore for Live Stats Without useEffect]]

- [[Hardcoded Concurrency Limits Blind Ops to Tuning Levers]]

- [[Session Storage Preserves First-Touch Attribution Without Cross-Tab Pollution]]

- [[TCP Fragmentation Splits SSE Events Mid-Boundary]]

- [[Feature-Flagged Variant Testing]]

- [[Retrieval Sort Prevents High-Relevance Jobs Sinking]]

- [[Remove Implementation-detail Tests, Keep Behavior Coverage]]

- [[Composite Scraper Abstracts Multi-platform Orchestration]]

- [[Multi-stage Title Normalization for Cross-platform Matching]]

- [[Flex Types for Ambiguous LLM Boundaries]]

- [[Responsive Primitives Compose Without Coupling]]

- [[Global Primitives Restyle for Design Consistency]]

- [[Computed Data Utility Hydrates API Response Into UI Shape]]

- [[Multi-Dimension Filtering via Tokenized Matching]]

- [[Flexible JSON Unmarshaling for LLM Provider Variance]]

- [[Composite Scraper with Primary/Secondary Semantics]]

- [[Centralized Environment Schema Coordinates Config Across Services]]

- [[Silent Test Convention Drift Requires Mechanical CI Enforcement]]

- [[Model Capacity Matters More Than Token Budgets for Complex Extraction]]

- [[Idempotent DDL Guards Breaking Changes During Gradual Rollout]]

- [[Core Scenarios Plus One Edge Case Per Module]]

- [[RwLock Prevents Svelte Reactivity Race in Polling Loops]]

- [[Cache Schema Versioning Handles Source Deprecation Cleanly]]

- [[Unified Cache Identity Across Heterogeneous Source Implementations]]

- [[Source Lifecycle Complexity Hides Across Distributed Systems]]

- [[Prioritize Cache Lookup Before Fallback Chains]]

- [[Dynamic Domain Context Beats Maintained Taxonomies]]

- [[Resolver Fallback Chains Hide Test Failures]]

- [[Svelte each_key_duplicate from Polling Race Condition]]

- [[SQLite for User-Resumable Features]]

- [[Test Shared Patterns in Parallel Across Multiple Services]]

- [[CORS Validation at Server Startup Decouples Config from Request Handling]]

- [[Explicit Opt-In Gate for Dangerous Operations]]

- [[Dependency Injection for Environment-Driven Code]]

- [[Separate PRs per Production Behavior]]

- [[Idempotent Schema Migrations Preserve Data Through Transition]]

- [[Split Data Models for Different Analysis Questions]]

- [[Terminology Abstraction Prevents Cascade Maintenance]]

- [[Search History Enables Analytics Without Separate Service]]

- [[Test Data Splitting Prevents Eval Overfitting]]

- [[Extract Dashboard Primitives for Reuse]]

- [[Pre-Compute Trends Server-Side]]

- [[Centralized Terminology Prevents Cross-Component Drift]]

- [[Sparklines Without Charting Libraries]]

- [[Dedicated APIs enable clear separation of concerns in analytics features]]

- [[Reusable visualization primitives ensure consistent styling across surfaces]]

- [[Sparkline rendering: balancing SVG path precision against rendering cost]]

- [[Realistic sample data is more valuable than current-state snapshots for demos]]

- [[Trends require database-layer time-series aggregation]]

- [[Score Distribution Monitoring Detects Judge Drift]]

- [[Impact Weights as Constants Over Database Rows]]

- [[Idempotent Migrations Enable Gradual Schema Evolution]]

- [[Centralize Product Language to Enable Experimentation]]

- [[Separate Aggregation from Records to Avoid Query Bloat]]

- [[Schema Discipline Early: ON DELETE CASCADE Prevents Orphans]]

- [[Aggregate Logic Deserves Its Own Layer]]

- [[Separate Raw from Derived Data in API Responses]]

- [[Preflight Gates Block Pipeline on Judge Failure]]

- [[Terminology as First-Class Infrastructure]]

- [[Centralized Terminology Module Prevents Cross-Component Language Drift]]

- [[Stage Complex Migrations Incrementally to Avoid Production Breakage]]

- [[Centralized Terminology Library at Render Time]]

- [[Gap Calculation Separated from Aggregation for Explainability]]

- [[Complex Business Logic in Application Code]]

- [[Stable Proxies for Unstable Concepts]]

- [[Entries Table and Full Reaggregation]]

- [[Per-Judge Canaries Target Specific Failure Modes]]

- [[Backward-Compatible SSE Event Routing with Callbacks]]

- [[Blur-Triggered State Without useEffect]]

- [[Resume-Job Linking: Fallback State + Clear Errors]]

- [[Validation Mechanisms Create Obligation, Which Generates Noise]]

- [[Evidence Quoting Defends Against Judge Gaming]]

- [[Scores keyed by natural unique identifier]]

- [[Heuristic Filtering Gate Before Expensive LLM Work]]

- [[Heuristic Intent Analysis Avoids LLM Latency]]

- [[Spot-Check as Audit Trail]]

- [[Debounce Keystroke Triggers for API Load]]

- [[Taxonomy as Quality Testing Framework]]

- [[SSE for LLM Streaming Over Polling]]

- [[Judge Cases Catch Quality Regressions in Isolation]]

- [[Auto-trigger With Debounce Balances Responsiveness and Load]]

- [[Gate LLM Refinement With Heuristic Pre-filters]]

- [[Quality Metric Testing Requires Human Judge Criteria]]

- [[Metadata-Based Golden Set Partitioning]]

- [[SSE Avoids Polling Timeouts for Long-Running LLM Feedback]]

- [[Keystroke Debounce at 300ms Balances Responsiveness and Cost]]

- [[Heuristics-First Gate Reduces LLM Cost Without Sacrificing Quality]]

- [[Taxonomy-First Quality Gates vs Free-Form Heuristics]]

- [[SSE Streams Simplify LLM Incremental Output vs Polling]]

- [[Debounced Keystroke Triggers Achieve 10x API Load Reduction]]

- [[Confusion Matrix Reveals Judge Behavior Patterns]]

- [[Track Intent-Suggestion Interaction Without Logging Per-Keystroke]]

- [[Normalize Resume Titles to Enable Fuzzy Matching Against Intent]]

- [[SSE Eliminates Polling Boilerplate for Streaming Async Results]]

- [[Layer Keystroke Debounce with API Debounce to Avoid Lag]]

- [[Heuristic-First Quality Scoring Defers LLM to Edge Cases]]

- [[Inline Refinement UI Reduces Suggestion Friction]]

- [[Domain-Specific Quality Taxonomy Catches Hallucination]]

- [[Debounced Keystroke Triggers Require Latency Tuning]]

- [[Resume Context Predicts Search Intent Quality]]

- [[Quality Thresholds Need Concrete Test Cases with Pass/Fail Rules]]

- [[SSE Streaming Feels Faster Than Polling for LLM Responses]]

- [[Debounce the Request, Not the Response]]

- [[Heuristic Layer Plus LLM Refinement Catches More Edge Cases]]

- [[Keystroke API Thrashing Requires Aggressive Debouncing]]

- [[Request Ordering Prevents Stale Updates in Rapid Keystroke Sequences]]

- [[Debounce Real-Time Suggestions to Reduce Backend Thrashing]]

- [[Resume Context Gates Hallucinated Skills]]

- [[Leading-Edge + Trailing-Edge Debounce Preserves User Input]]

- [[Logging Suggestion Outcomes Creates Training Signal Without Explicit Retraining]]

- [[Streaming Incremental Output Feels Faster Than Waiting for Completion]]

- [[Keystroke Debounce Cuts API Calls 80% Without Sacrificing Responsiveness]]

- [[Taxonomy Classification Before LLM Saves 60% of Inference Calls]]

- [[Sequential Gate Design Catches Failures at Different Speeds]]

- [[Derive Explanations Client-Side to Keep APIs Stable]]

- [[Explanation Panels Skip Redundant Job Metadata]]

- [[Classify Jobs Before Applying Rubrics, Not After]]

- [[Golden Datasets Catch Category Regressions]]

- [[Registry Pattern Centralizes Scoring Rubrics]]

- [[Verify Plan Agent Outputs Against Implementation]]

- [[Gate Scope Boundaries: Data and Behavior Are Feature Work]]

- [[Harness Line Limits Drive Semantic File Splits]]

- [[Transition handoff docs from spec to summary when work ships]]

- [[HTTP.MaxBytesReader Establishes Upload Hard Limit First]]

- [[File Split Respects Pre-commit Hook Code Boundaries]]

- [[GitHub Issues as System of Record Avoids Transient State]]

- [[User-Agent from Request Header, Not Form Body]]

- [[EXIF Stripping via Re-encoding Balances Privacy and Quality]]

- [[MIME-Based Extension Validation Prevents Upload Spoofing]]

- [[Thread Attributes Through Props Over Refs]]

- [[Shared Preflight Library for Canary Gates]]

- [[Prefer Focused Hooks Over Mega-Hooks]]

- [[400-Line React Hook Threshold Triggers Extraction]]

- [[Centralize Sample Data for Conditional Onboarding Flows]]

- [[Session-Scoped Refs Prevent Completion Race Conditions]]

- [[Distinguish Loading State From Data Readiness]]

- [[Atomic SQL JSONB Append Prevents Race Conditions]]

- [[Decouple Critical Paths from Optional Authentication]]

- [[Graceful Frontend Handling for Disabled Endpoints]]

- [[Advisory Lock for Migration Serialization Across Test and Production]]

- [[Upsert with Selective Column Refresh]]

- [[Schema Constraints with Deferred Validation]]

- [[Consolidate N+1 Methods into Single DB Call]]

- [[Multi-Value INSERT ON CONFLICT Requires Application Deduplication]]

- [[JSONB Array First-Occurrence Removal]]

- [[Test Bypasses Respect Logic Boundaries]]

- [[Compiler as Refactor Validator]]

- [[No Stacked PRs: Merge Dependencies Downward]]

- [[Atomic Operations Via Transaction Wrapper]]

- [[Executor Interface Unifies DB and Tx]]

- [[Line-Count Hook Forces Good File Splits]]

- [[Three-Tier Cache Fill Pattern]]

- [[Two-Pronged Cache Invalidation After Deletion]]

- [[Animation lock should fire after real animation, not initial render]]

- [[Removing staleTime:0 silently lengthens cache window]]

- [[Per-User Cache Layer Must Invalidate Both Layers or Neither]]

- [[Coordinated Animation Lifecycles Prevent Drag-Drop Flicker]]

- [[Empty State Z-fighting with AnimatePresence]]

- [[Capturing Card Height Before Invisible State]]

- [[Imperative Array Construction for Spliced Elements in React]]

- [[Directional Animation via Index Comparison]]

- [[Score-Sorted Placeholder Insertion in Kanban]]

- [[Optimistic Updates and Animation Timing Collide]]

- [[Force Framer-Motion List Remount Via Parent Key]]

- [[Invisible Unicode Characters Break Scraped Job Descriptions]]

- [[go vet in go.work Monorepos Requires Module-Specific Paths]]

- [[React Query: Invalidate Queries When Mutations Change Server State]]

- [[Domain-Aware Search Fixes Ambiguous Tech Term Retrieval]]

- [[Standalone Binary + Batch LLM Calls for One-Time Data Migrations]]

- [[Enumerate All Variants When Filtering Legacy Data]]

- [[Organize Micro-Animation Patterns by Interaction Type, Not Page]]

- [[framer-motion layoutId Solves Multi-Node Animations]]

- [[Phased Library Adoption Avoids Animation Sprawl]]

- [[Animation Restraint Guardrails Prevent Scope Creep]]

- [[Groq Failed Requests Count Against Token Limits]]

- [[AnimatedCounter Loop Edge Case]]

- [[Query Cache Invalidation on Mutation]]

- [[Edit vs. Write Asymmetry for Debug Statement Detection]]

- [[Binary vs. Semantic Rules Partition]]

- [[Session-Scoped Read Tracking Prevents Stale Edits]]

- [[TIMESTAMPTZ Across All Temporal Columns]]

- [[Singleflight Deduplicates Concurrent Requests]]

- [[Learnable vs. Non-Learnable Skill Classification]]

- [[Database Connection Pool Tuning for Throughput]]

- [[HTTP Client Timeouts Prevent Hanging Requests]]

- [[Context-Aware Goroutine Lifecycle Prevents Resource Leaks]]

- [[4-Phase Refactor by Problem Category]]

- [[Frosted Glass for Floating UI Readability]]

- [[Imperative Expand/Collapse Animations Over Components]]

- [[Page Transitions via Location Pathname Keying]]

- [[Node.js 25 Http.globalAgent.keepAlive Breaks Vite Proxy]]

- [[Animated Counter Behavior Split by Magnitude]]

- [[Stateless Judges Keep Anchor Bias Out of Calibration]]

- [[Use React.lazy and Suspense for Route-Level Code Splitting]]

- [[Use Enabled Gates to Skip Unnecessary Query Executions]]

- [[Use DOMPurify for HTML Input, markdown-it for Markdown Rendering]]

- [[Use Varying Timeout Thresholds Based on Request Type]]

- [[Centralized Query Key Factory Reduces Brittleness and Duplication]]

- [[Error States Must Include Retry Handlers, Not Just Fallback UI]]

- [[Large-Scale Frontend Refactors Follow a Four-Phase Progression]]

- [[Focused Eval Scripts Enable Fast Iteration on Generation Quality]]

- [[Fail Fast on Limits Before Multipart Parsing]]

- [[409 Conflict Signals State Limit, Not Auth Failure]]

- [[Localize Currency With Approximate USD Conversion]]

- [[Salary Period Inference From Job Description]]

- [[Custom fetch-based streaming handles CORS without EventSource library swap]]

- [[Empty VITE_API_URL env var preserves dev proxy; absolute URL in production]]

- [[Staging environment catches infrastructure bugs that dev environment cannot]]

- [[Railway + Neon beats Fly.io on hosting costs for pre-revenue projects]]

- [[Filter Generic Rules for Your Actual Stack]]

- [[Documentation Maintenance Requires Active Removal]]

- [[Verify Tool Constraints Before Proposing Solutions]]

- [[Normalize Before Caching Prevents Quota Waste]]

- [[Accumulate Feedback Across Retry Loops]]

- [[Unicode Tokenizer Artifacts in LLM Output]]

- [[Exit Code 143 Indicates SIGTERM Timeout]]

- [[Boundary Filtering to Prevent Pipeline Cascade]]

- [[Cascading Hook Failures in Pipeline Automation]]

- [[Pre-Launch Accessibility Audit Checklist]]

- [[Canonical vs Display-Name Separation]]

- [[Aria-Live Announcements for Visual-Only Feedback]]

- [[Tiptap onBlur Config Plus Refs Avoid useEffect Hook Friction]]

- [[Defense in Depth: Frontend Check Plus Backend Validation]]

- [[Client-Side Data Resolution Avoids API Bloat]]

- [[Security audits as parallel CI job]]

- [[Singleflight Deduplication for Concurrent Cache Misses]]

- [[Pre-commit hook catches format violations early]]

- [[Biome as single-tool linter+formatter]]

- [[Component Extraction Targets Oversized Container Pages]]

- [[Test Suite as Pre-Launch Checklist Closure Tool]]

- [[HTML Structure Parsing Preserves Formatting in PDF Export]]

- [[Markdown-It + HTML Passthrough for LLM-to-Editor Pipeline]]

- [[Model Tiering by Content Length Reduces Cost]]

- [[usedForContent Timing Prevents Rediscovery of In-Flight Topics]]

- [[Lazy-Fetch Endpoints Preserve API Cost]]

- [[All Content Paths Must Flow Through the Critical Gate]]

- [[Claude Code Environment Variables Leak to Child Processes]]

- [[execFile Error Objects Require Explicit Field Extraction]]

- [[Parallelized KB Scanning Reduces Wall-Clock Time]]

- [[Fresh Rerun Extraction Strips Accumulated State]]

- [[Promise.race Doesn't Cancel Underlying Promises]]

- [[7-Day Cache TTL for API Cost Control]]

- [[Promise.all Silent Catch Returns Empty Cascades Downstream]]

- [[JSONL Append-Only Error Log with Probabilistic Pruning]]

- [[Always-On Polling Replaces Conditional Start/Stop for Determinism]]

- [[Worker-Level Timeouts as Safety Net for Stage-Bounded Work]]

- [[Fire-and-Forget Error Swallow Hides Entire Categories of Failure]]

- [[Stacked PRs Must Target Main, Never Feature Branches]]

- [[Backend Spec Enforcement, Frontend Pre-Upload Validation]]

- [[Slop Gate Runs Before AI-Generated Content Ships]]

- [[Resume Search Verification Prevents Hallucinated Gaps]]

- [[Explicit Job Boundaries Prevent Cross-Contamination]]

- [[Parameterized Pipelines Reduce Rewrite Cost]]

- [[Dual-Path Rehydration: Resume vs Fresh]]

- [[Rehydration as First-Class Export Concern]]

<!-- Atomic notes in this pillar will be auto-linked here by the nuggets embed phase.
     Manual additions are fine too — just keep one note per [[Wikilink]] line. -->
