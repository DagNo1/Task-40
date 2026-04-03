# SentinelDesk Questions Log

Business Logic Questions Log:

Story identity and dedup scope
Question: Should deduplication run globally across all ingested sources, or only within the same source/vendor feed?
My Understanding: Editorial workflows usually require global dedup across all sources to avoid publishing duplicate stories from different vendors.
Solution: Apply dedup clustering globally, but retain source provenance metadata so editors can still compare source-specific versions.

URL batch ingestion behavior
Question: When editors paste a batch of URLs, does the system fetch remote content immediately or only store/normalize submitted URLs?
My Understanding: Because the system is on-prem and must not rely on the public internet, URL ingestion should primarily support internal/local reachable content and metadata-only processing if content is unavailable.
Solution: Treat pasted URLs as ingest candidates; normalize and dedup URLs first, then process content only when fetch is available in the local network context.

Merge strategy audit granularity
Question: For merge actions (replace, append, keep both), what audit granularity is required for before/after data?
My Understanding: Auditors need full traceability of who changed what and why, including prior and resulting story version references.
Solution: Log merge actor, timestamp, selected strategy, mandatory change note, old/new version IDs, and a structured diff snapshot.

Mandatory change note validation
Question: What qualifies as a valid mandatory change note (minimum length, disallowed empty placeholders)?
My Understanding: Free-form notes can degrade traceability unless validated for useful content.
Solution: Enforce note validation (for example min 15 chars, non-whitespace, reject placeholder-only text) before merge can be committed.

Finance settlement timing
Question: At what lifecycle point is the internal charge (e.g., $25.00 bundle fee) created: on ingestion, editor approval, or publication readiness?
My Understanding: Charging should occur only after a story is in an approved/licensable state to avoid overbilling rejected items.
Solution: Create charge events on explicit finance-eligible story states (post-editor approval), not at raw ingestion time.

Partial refund rules
Question: How should partial refunds be constrained (max refund per transaction, multi-refund allowed, reason codes required)?
My Understanding: Refund logic needs strict controls and explicit reason codes to prevent misuse and simplify audits.
Solution: Allow multiple partial refunds until cumulative refunded amount reaches original charge, require refund reason code plus free-text note, and block over-refund attempts.

Transaction freeze ownership
Question: Can Finance Reviewers both freeze and unfreeze disputes, or is unfreeze restricted to Auditors only?
My Understanding: The prompt states freezes can be applied until an Auditor releases them, implying unfreeze authority belongs only to Auditors.
Solution: Implement role rule where Finance Reviewer can freeze, only Auditor can release freeze, and all freeze transitions are immutable audit events.

Role masking policy precedence
Question: When multiple roles apply to one user (e.g., Admin plus Auditor), which masking policy takes precedence?
My Understanding: Least-privilege should apply unless explicit elevated permission is granted for the requested action.
Solution: Use explicit policy precedence: deny-by-default, role union for action permissions, and most restrictive masking unless privileged scope is explicitly present.

API versioning compatibility
Question: Should v1 and v2 expose identical semantics with schema evolution, or can business behavior differ by version?
My Understanding: Versioning should preserve predictable behavior while allowing additive improvements and controlled breaking changes.
Solution: Keep business semantics stable where possible, document behavior deltas in the OpenAPI changelog, and enforce contract tests per version.

Idempotency key lifecycle for payment channels
Question: How long should idempotency keys be retained, and what is the expected behavior for duplicate callbacks after retention expiry?
My Understanding: Keys should be retained long enough to cover delayed retries from internal channel systems.
Solution: Store idempotency keys with configurable TTL (for example 24 to 72 hours); duplicates inside TTL return prior result; outside TTL are treated as new requests with replay and signature checks still enforced.

Backup restore validation
Question: What constitutes a tested restore procedure for the 2-hour recovery window objective?
My Understanding: Compliance requires periodic drill evidence, not only documented steps.
Solution: Implement scheduled restore drills (for example weekly), record start and end timing, run data integrity checks, and archive drill reports in audit-accessible logs.

Similarity threshold governance
Question: Who can configure SimHash/MinHash similarity thresholds, and does changing thresholds trigger re-clustering of historical data?
My Understanding: Threshold changes materially affect dedup outcomes and should be restricted and auditable.
Solution: Restrict threshold changes to Admins, record old and new values with reason, and run explicit re-clustering jobs with before-and-after cluster metrics.
