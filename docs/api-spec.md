# SentinelDesk API Specification

## Overview

SentinelDesk exposes local, versioned REST APIs from the NestJS backend.

- Base API prefix: `/api`
- Supported versions: `/api/v1` and `/api/v2`
- Local OpenAPI UI: `/openapi/v1` and `/openapi/v2`
- OpenAPI JSON: `/openapi/v1.json` and `/openapi/v2.json`

Default local host:

- Backend: `http://localhost:3000`
- API base: `http://localhost:3000/api`

## Common Conventions

### Authentication and Session

- Local auth uses a session cookie named `sid`.
- `POST /auth/login` issues a session and CSRF token.
- `GET /auth/csrf` rotates and returns a new CSRF token for an existing session.
- Session-protected routes use session and permission guards.

### CSRF

- Session-authenticated write routes generally require `x-csrf-token`.
- Payment channel callbacks (`/payment-channels/:channel/charge`) are signature-authenticated and do not use session CSRF flow.

### Content Types

- Most endpoints accept and return JSON.
- `POST /ingestion/upload` accepts `multipart/form-data`.
- `GET /reports/audit/export.csv` returns `text/csv`.

### Version Behavior

Both API versions expose the same major resource areas; `v2` adds response metadata for selected endpoints without changing the core workflow.

## Endpoint Groups

### Health

- `GET /v1/health`
- `GET /v2/health`
- `GET /v1/health/summary`
- `GET /v2/health/summary`

Purpose:

- readiness checks for PostgreSQL and Redis
- summarized offline-ready status and job summary

### Auth

- `POST /v1/auth/login`
- `POST /v2/auth/login`
- `POST /v1/auth/logout`
- `POST /v2/auth/logout`
- `GET /v1/auth/me`
- `GET /v2/auth/me`
- `GET /v1/auth/csrf`
- `GET /v2/auth/csrf`
- `POST /v1/auth/mfa/enroll`
- `POST /v2/auth/mfa/enroll`
- `POST /v1/auth/mfa/verify`
- `POST /v2/auth/mfa/verify`

Purpose:

- local username/password login/logout
- session inspection
- CSRF token rotation
- offline TOTP MFA enrollment and verification

Version difference:

- `v2` login includes a `policy` block.
- When MFA is required, `v2` returns `status: mfa_required` with policy metadata.

### Ingestion

- `POST /v1/ingestion/upload`
- `POST /v2/ingestion/upload`
- `POST /v1/ingestion/url-batch`
- `POST /v2/ingestion/url-batch`

Purpose:

- parse XML/JSON/CSV feed uploads
- ingest URL batches

Request notes:

- upload requires `source` + multipart `file`
- URL batch accepts `source` + `urls[]`

Version difference:

- `v2` ingestion responses add dedup threshold metadata (`simhashMaxHamming`, `minhashMinSimilarity`).

### Stories

- `GET /v1/stories`
- `GET /v2/stories`

Purpose:

- list/search stories for editorial and transaction workflows

Query parameters:

- `q` (optional text search)

### Editor Queue

- `GET /v1/editor-queue`
- `GET /v2/editor-queue`
- `GET /v1/editor-queue/:storyId/diff`
- `GET /v2/editor-queue/:storyId/diff`
- `POST /v1/editor-queue/merge`
- `POST /v2/editor-queue/merge`
- `POST /v1/editor-queue/repair/:versionId`
- `POST /v2/editor-queue/repair/:versionId`

Purpose:

- list reviewable story updates
- compare versions side-by-side
- merge with strategy + trace notes
- repair versions with auditability

Request notes:

- diff requires `leftVersionId` and `rightVersionId`

Version difference:

- `v2` queue response adds `mergeStrategies`.

### Transactions

- `GET /v1/transactions`
- `GET /v2/transactions`
- `GET /v1/transactions/story-versions`
- `GET /v2/transactions/story-versions`
- `GET /v1/transactions/:id/history`
- `GET /v2/transactions/:id/history`
- `POST /v1/transactions/charges`
- `POST /v2/transactions/charges`
- `POST /v1/transactions/:id/approve`
- `POST /v2/transactions/:id/approve`
- `POST /v1/transactions/:id/refunds`
- `POST /v2/transactions/:id/refunds`
- `POST /v1/transactions/:id/freeze`
- `POST /v2/transactions/:id/freeze`
- `POST /v1/transactions/:id/release`
- `POST /v2/transactions/:id/release`

Purpose:

- list transactions and chargeable story-version options
- charge/approve/refund/freeze/release workflows
- retrieve transaction history

Permission notes:

- read/list/history/story-versions: `transactions.read`
- create/approve charges: `finance.review`
- refunds: `finance.refund`
- freeze: `finance.freeze`
- release: `auditor.release_freeze`

Version difference:

- `v2` list response adds `config.licensedStoryBundleCents`.

### Reports

- `GET /v1/reports/audit`
- `GET /v2/reports/audit`
- `GET /v1/reports/audit/export.csv`
- `GET /v2/reports/audit/export.csv`

Purpose:

- search immutable audit logs
- export filtered audit rows as CSV

Query parameters:

- `from`
- `to`
- `userId`
- `actionType`

Date handling:

- reports endpoints enforce `MM/DD/YYYY` parsing.

Version difference:

- `v2` search response adds `acceptedDateFormat`.
- `v2` CSV filename is `audit-report-v2.csv`.

### Admin

- `GET /v1/admin/overview`
- `GET /v2/admin/overview`
- `PUT /v1/admin/roles`
- `PUT /v2/admin/roles`
- `PUT /v1/admin/users/:id/roles`
- `PUT /v2/admin/users/:id/roles`
- `PUT /v1/admin/users/:id/rate-limit`
- `PUT /v2/admin/users/:id/rate-limit`
- `PUT /v1/admin/thresholds/:key`
- `PUT /v2/admin/thresholds/:key`
- `GET /v1/admin/operations/permission-sensitive`
- `GET /v2/admin/operations/permission-sensitive`

Purpose:

- inspect admin overview
- manage roles/user roles/rate limits/system thresholds
- inspect permission-sensitive operations

Version difference:

- `v2` overview adds `defaultRateLimit`.

### Alerts

- `GET /v1/alerts/dashboard`
- `GET /v2/alerts/dashboard`
- `PATCH /v1/alerts/:id/resolve`
- `PATCH /v2/alerts/:id/resolve`

Purpose:

- list active alerts, banners, and job status
- resolve alert events

Version difference:

- `v2` dashboard adds supported `categories`.

### Profile (Sensitive)

- `GET /v1/profile/sensitive`
- `GET /v2/profile/sensitive`
- `PUT /v1/profile/sensitive`
- `PUT /v2/profile/sensitive`

Purpose:

- read/update sensitive profile data with role-aware access controls

Query parameters:

- `userId` (optional; requires `admin.manage` when targeting another user)

### Payment Channels

- `POST /v1/payment-channels/:channel/charge`
- `POST /v2/payment-channels/:channel/charge`

Supported channels:

- `prepaid_balance`
- `invoice_credit`
- `purchase_order_settlement`

Required headers:

- `x-system-id`
- `x-signature`
- `x-timestamp`
- `x-nonce`
- `x-idempotency-key`

Purpose:

- receive signed internal channel charge requests
- verify signature/freshness
- enforce replay and idempotency constraints

Version difference:

- `v2` response adds `verification` metadata (`requiredHeaders`, `replayWindowSeconds`).

## Frontend API Consumption

The React client defaults to `v1` and can switch to `v2` using `VITE_API_VERSION=v2`; it sends credentials with each request and attaches CSRF tokens for write methods.

## Verification

Useful local checks:

- `GET http://localhost:3000/api/v1/health`
- `GET http://localhost:3000/api/v1/health/summary`
- `GET http://localhost:3000/openapi/v1`
- `GET http://localhost:3000/openapi/v2`
