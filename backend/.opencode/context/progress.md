# Project Progress

## Current Stage

**Phases 1–8 complete; Phase 9 pending**

### Completed

- [x] Repository created
- [x] Backend scaffolded — NestJS 12, TypeScript 6, ESM
- [x] Database — PostgreSQL 16 via Docker Compose (`pgvector/pgvector:pg16`, container `ai-support-postgres`, volume `backend_postgres_data`)
- [x] Prisma 7 stable + driver adapter (`@prisma/adapter-pg` / `PrismaPg`), classic `schema.prisma`
- [x] 10-table schema + migrations applied (`init`, `knowledge_filename_unique`, `reconcile_embedding_dims_768`, `add_order_refunded_status`)
- [x] Seed data loaded — 3 customers, 5 orders (123/124/125, 456, 789), 2 staff users (admin + agent), 3 knowledge docs
- [x] `CustomersModule`, `OrdersModule`, `RefundsModule`, `UsersModule`, `AuthModule`, `PrismaModule`, `EmbeddingsModule`, `RagModule`, `DecisionModule`, `AuditModule`, `TicketModule`, `ApprovalsModule` all wired into `AppModule`
- [x] `npm run build` passes (exit 0); unit tests pass (Vitest — 38 cases across 5 files)
- [x] End-to-end verification of `/orders/:id` (literal curl output):
  - `GET /orders/123` → `200` body `amount: "750"`
  - `GET /orders/789` → `200` body `amount: "2500"`
  - `GET /orders/999` → `404` body `{"message":"Order 999 not found","error":"Not Found","statusCode":404}`
- [x] `.env` + `.env.example` with DATABASE_URL, JWT secrets/TTLs, `AI_PROVIDER=mock`, `EMBEDDING_PROVIDER=mock`, `AI_EMBED_MODEL=nomic-embed-text`, `EMBEDDING_DIMS=768`, business-rule limits
- [x] Linting (oxlint), formatting (Prettier), Observability (NestJS Observe, placeholder credentials)
- [x] `AiModule` (`/ai/classify`) — provider selection via `AI_PROVIDER` env var, default **mock** (no external services). zod-validated `TicketClassification` contract, OpenAI-compatible provider via plain `fetch` (reads `AI_BASE_URL` / `AI_API_KEY` / `AI_CHAT_MODEL`)
- [x] Mock provider unit tests (Vitest, deterministic, no network) — 8 cases pass; build exit 0
- [x] End-to-end verification of `/ai/classify` (literal curl output):
  - `POST {"message":"My order #123 arrived damaged. I want a refund."}` → `201` body `{"intent":"damaged_order","orderId":"123","priority":"high","confidence":0.95}`
  - `POST {"message":"Where is my order #456?"}` → `201` body `{"intent":"order_status","orderId":"456","priority":"medium","confidence":0.9}`
- [x] RAG `EmbeddingsModule` — `EMBEDDING_PROVIDER` env default **mock** (token-hash bag-of-words, deterministic, normalized, 768-dim; OpenAI-compatible via `fetch` reads `AI_BASE_URL`/`AI_API_KEY`/`AI_EMBED_MODEL`). EmbeddingsService validates vector dims; providers registered via factory
- [x] RAG `RagModule` — `POST /knowledge` chunks markdown (section split, 800-char windows, 80-char overlap, H1-title derivation), embeds, stores via raw SQL `vector(768)`; re-ingest idempotent by filename (delete + cascade chunks + recreate in a `$transaction`); `GET /knowledge/search?q=&topK=` cosine-similarity retrieval (`1 - (embedding <=> $1::vector)`)
- [x] Prisma does **not** diff `Unsupported(...)` type strings — `reconcile_embedding_dims_768` migration was hand-written and applied via `npx prisma migrate deploy`; `migrate status` up-to-date; column verified `vector(768)`
- [x] End-to-end verification of RAG (literal curl output):
  - `POST /knowledge {"filename":"refund-policy.md", ...}` twice → `201` both times, distinct documentId (idempotent replace)
  - `docker exec ... SELECT filename, COUNT(*) ... GROUP BY filename` → exactly 1 `refund-policy.md` (total docs unchanged: 3)
  - `docker exec ... SELECT COUNT(*) FROM "KnowledgeChunk"` → `1`
  - `GET /knowledge/search?q=damaged order refund&topK=3` → `200` `[{...,"title":"Refund Policy","filename":"refund-policy.md","score":0.3726...}]`
- [x] Decision engine `DecisionModule` (`src/decision/`) — pure, dependency-free `evaluateDecision` (no Prisma/HTTP/AI): intent gate → confidence gate → order lookup → delivered check → refund window → amount threshold → AUTO_REFUND / REQUEST_HUMAN_APPROVAL / REJECT_REFUND / ORDER_NOT_FOUND / NEEDS_HUMAN_REVIEW / NO_ACTION. `DecisionService` thin wrapper (env policy or override). Scenario-table unit tests (16 cases) cover boundary rules (exactly at 30 days/500/0.85 vs ±1 unit) and gate ordering; **38 tests total pass** across 5 files
- [x] Ticket workflow `TicketModule` (`src/tickets/`) — `POST /tickets`, `GET /tickets/:id`, `GET /tickets`. `TicketService.processTicket` orchestrates: `ticket.create` → AI classify (`AiService`) → RAG search (chunks into response prompt) → order lookup → `DecisionService` → side effect (auto refund via `tx.refund` idempotent `findUnique`-then-create + `order` → `REFUNDED`, or `approvalRequest.create` PENDING + status `WAITING_APPROVAL`) → customer response → status `RESOLVED`/`FAILED`. All work inside a `$transaction` (audit log rows included); ticket row created **before** the tx so the FAILED fallback persists on rollback
- [x] `AuditModule` (`src/audit/`) — `AuditService.record(ticketId, event, actor, metadata, db?)`; maps `customer`/`agent` → `HUMAN`, `ai` → `AI`, `system` → `SYSTEM`; accepts an injected tx sink (Prisma 7 exports no `TransactionClient` type — untyped cast)
- [x] AI response generation — `AiProvider.generateCustomerResponse(product { decision, context })` with deterministic `ResponseContext`; mock: 6 templates keyed by `decision.action`; OpenAI-compatible: temperature 0.2, RAG policy chunks placed in prompt, trimmed text
- [x] End-to-end verification of `/tickets` (literal curl output, mock providers):
  - `POST {"message":"My order #124 arrived damaged. I want a refund."}` → `201` `decision.action: "AUTO_REFUND"`, `refund.status: "COMPLETED"`, `ticket.status: "RESOLVED"`
  - `POST {"message":"Where is my order #456?"}` → `201` `decision.action: "NO_ACTION"` / `reason: "INTENT_NOT_REFUND"`, `ticket.status: "RESOLVED"`
  - `POST {"message":"My order #123 arrived damaged. I want a refund."}` → `201` `decision.action: "REQUEST_HUMAN_APPROVAL"` / `reason: "AMOUNT_EXCEEDS_AUTO_THRESHOLD"`, `approval.status: "PENDING"`, `ticket.status: "WAITING_APPROVAL"`
  - `POST {"message":"My order #125 arrived damaged. I want a refund."}` → `201` `decision.action: "REJECT_REFUND"` / `reason: "OUTSIDE_REFUND_WINDOW"`, `ticket.status: "RESOLVED"`
  - `POST {"message":"My order #99999 arrived damaged. I want a refund."}` → `201` `decision.action: "ORDER_NOT_FOUND"`, `ticket.status: "RESOLVED"`
  - `GET /tickets/:id` trace (auditLogs asc): `TICKET_CREATED → AI_CLASSIFICATION → RAG_RETRIEVED → ORDER_LOOKED_UP → DECISION_MADE → REFUND_CREATED → RESPONSE_GENERATED → TICKET_RESOLVED`
  - DB: exactly 1 `Refund` (order 124, COMPLETED), exactly 1 `ApprovalRequest` (order 123, REFUND/PENDING, 750.00), 5 tickets, 37 audit rows
- [x] `npm run build` passes (exit 0); unit tests pass (Vitest — **44 cases across 6 files**, +6 `ticket.service.spec` scenarios); lint clean (only 2 pre-existing `src/orders/` warnings)
- [x] **Phase 3 cleanup — global auth guards live.** `JwtAuthGuard` + `RolesGuard` registered via `APP_GUARD` in `AuthModule` (JwtAuthGuard first — populates `request.user`; RolesGuard second — reads `request.user.role`). `@Public()` already existed and was honored by `JwtAuthGuard` (Reflector `getAllAndOverride` of `IS_PUBLIC_KEY`). `@Roles(...)` decorators everywhere are now **enforced**. `@Public()` added class-level to `AiController` (`/ai/classify`), `RagController` (`/knowledge`), `TicketController` (`/tickets`), and method-level to `AppController.getHello` (root health). **Not** added to `CustomersController`/`OrdersController`/`RefundsController` — they already declare class-level `@Roles(AGENT, ADMIN)`; `@Public()` there would have turned them always-403 (JwtAuthGuard bypassed, RolesGuard still runs with no user). `AuthController` already had `@Public()` on register/login/refresh; `me`/`logout` stay protected. `UsersController` unchanged (ADMIN/AGENT gates)
- [x] Part 1 verification (literal output): `GET /orders/123` (no token) → `401 {"message":"Missing access token","error":"Unauthorized","statusCode":401}`; `POST /auth/login` (agent) → `200 { user, tokens: { accessToken, refreshToken } }`; `GET /orders/123` (Bearer agent token) → `200 {id:"123", status:"DELIVERED", amount:"750", ...}`; `POST /tickets` (no token) → `201` (public)
- [x] **Phase 8 — order status transitions.** `refundedAt DateTime?` added to `Order` (migration `add_order_refunded_status`, only column add — `OrderStatus.REFUNDED` already existed). `RefundsService.createForTicket(ticketId, orderId, amount?, reason?, db?)` extracted (idempotent `findUnique`-then-create, `RefundStatus.COMPLETED`, then `order.update { status: 'REFUNDED', refundedAt: new Date() }`); `create(dto)` delegates to it; shared by `TicketService` (AUTO_REFUND branch) and `ApprovalsService`. Optional `db` sink mirrors `AuditService.record` so calls join the caller's `$transaction`
- [x] **Phase 8 — refund eligibility wrinkles.** `OrderSnapshot.hasCompletedRefund?: boolean` + reason `ORDER_ALREADY_REFUNDED`; `evaluateDecision` now rejects BEFORE the delivered/window/amount gates when `order.status.toLowerCase() === 'refunded'` **or** `hasCompletedRefund` (normalized lowercase, matching the existing delivered-check). `TicketService` fetches orders with `include: { refunds: { select: { status: true } } }` and passes `hasCompletedRefund: !!(order.refunds?.some(r => r.status === 'COMPLETED'))`
- [x] **Phase 8 — approval workflow.** `ApprovalsModule` (`src/approvals/`): `GET /approvals?status=` (list, status whitelist → 400), `POST /approvals/:id/approve`, `POST /approvals/:id/reject`; class-level `@Roles(AGENT, ADMIN)` — now really enforced. `approve`: load → PENDING check (`400 'Approval already resolved'`) → `$transaction`: `approvalRequest.update` (APPROVED, `decidedById`/`decidedAt`) → load ticket + order → `RefundsService.createForTicket(..., tx)` → `ticket.update` RESOLVED → audits `APPROVAL_APPROVED` (agent, `{approvedBy, refundId, amount}`), `ORDER_STATUS_TRANSITIONED` (system, `{orderId, from, to: 'REFUNDED'}`), `TICKET_RESOLVED` (system, `{finalStatus: 'RESOLVED', via: 'human-approval'}`). `reject`: same skeleton → REJECTED + ticket RESOLVED + audits `APPROVAL_REJECTED` (agent, `{rejectedBy, reason}`) and `TICKET_RESOLVED` (system, `{finalStatus: 'RESOLVED', via: 'human-rejection'}`). Note: TicketStatus has no REJECTED value; rejections resolve the ticket and record via='human-rejection' in the audit log
- [x] Phase 8 `TICKET_RESOLVED` finalStatus is always recorded when the workflow finishes (Phase 7 behavior preserved); for WAITING_APPROVAL tickets that fires with `finalStatus: WAITING_APPROVAL` at creation and then again after the human decision
- [x] Part 2 verification (literal output): login agent → `200`; `POST /tickets` (order 123) → `201` `decision.action: "REQUEST_HUMAN_APPROVAL"`, `ticket.status: "WAITING_APPROVAL"`, `approval.id` captured; `GET /approvals?status=PENDING` (Bearer) → `200` includes the new approval (+1 lingering Phase 7 PENDING row for order 123); `POST /approvals/:id/approve` (no token) → `401 Missing access token`; with token → `201` `approval.status: APPROVED`, `refund.status: COMPLETED`, `ticket.status: RESOLVED`; `GET /orders/123` → `200` `status: "REFUNDED"`, `refundedAt` non-null; `GET /tickets/:id` trace ends `APPROVAL_APPROVED → ORDER_STATUS_TRANSITIONED → TICKET_RESOLVED (via=human-approval)`; re-approve same id → `400 {"message":"Approval already resolved"}`; re-submitted order-123 ticket → `201` `decision.action: "REJECT_REFUND"` / `reason: "ORDER_ALREADY_REFUNDED"`
- [x] `npm run build` passes (exit 0); unit tests pass (Vitest — **54 cases across 7 files** = 44 + 4 decision wrinkle + 6 approvals); lint clean (only 2 pre-existing `src/orders/` warnings); `prisma migrate status` → 4 migrations, up to date
- [x] **Phase 9 prep — `processTicket` restructured to keep DB transactions short.** LLM classification, RAG retrieval, and AI response generation now run **outside** any transaction; DB transactions (default 5s interactive timeout) wrap only write-side effects and are sub-second. Verified with real Ollama (`AI_PROVIDER=openai`, qwen2.5:7b): a ~57s cold-start request completed — **zero** `expired transaction` errors, versus the pre-refactor `Transaction API error ... 27349 ms passed` under the old single 60s-bumped transaction. Mock verification (order 456 → `AUTO_REFUND`): 9-event audit trace preserved in order. Tests still **54/54**; `.env` left restored to `mock`

### Pending / Phase 3 follow-up

- [x] Register `JwtAuthGuard` globally via `APP_GUARD` in `AuthModule`, with a `@Public()` decorator opt-out for `/auth/login` and `/auth/register`.
- [x] Register `RolesGuard` globally after `JwtAuthGuard` so `@Roles(...)` metadata is actually enforced.
- [x] Verify `GET /orders/:id` returns 401 without a JWT once guards are live, then re-verify with a JWT from `POST /auth/login`.

### Config hygiene (deferred)

- [x] `REFUND_AUTO_LIMIT` is currently read by **no code** — confirmed again at the end of Phase 7 (decision engine reads only `AUTO_REFUND_THRESHOLD`, grep verified). Removal candidate for a config cleanup pass; left in place for now.
- [x] Re-verified at the end of Phase 7 that no config consumer reads the legacy var.

### Key technical decisions

- Prisma **7 stable** with the driver adapter (not Prisma 8 RC contract-based setup).
- Docker `pgvector/pgvector:pg16`, database user/db both `ai_support` (matching `backend/.env`).
- `docker-compose.yml` at the **project root** (`ai-customer-support/docker-compose.yml`) — validate with `docker compose config`; the running seeded container was **not** recreated.
- Enums are type-only unions in the generated client, so `@IsEnum(Role)` validates against the runtime const while the type side uses string literals (e.g. `Exclude<Role, 'CUSTOMER'>`).
- Prisma error classes import from `@prisma/client/runtime/client` (the `runtime/library` path does not exist in v7).
- RAG embedding dimension reconciled to **768** (`nomic-embed-text`); `KnowledgeChunk.embedding` is `Unsupported("vector(768)")`, seeded `KnowledgeDocument`s (no chunks) left untouched.
- `POST /knowledge` is **idempotent by filename** (replaces doc + cascaded chunks in a transaction) — documented contract in `RagService.ingestDocument`.
- Mock embedding provider uses **token-hash bag-of-words** (deterministic, normalized) so related content gets positive cosine scores — deviate from the original pseudo-random spec to satisfy `score > 0` verification; all 5 mock provider tests unchanged.
- Decision engine reads `AUTO_REFUND_THRESHOLD` (now in `.env`); legacy `REFUND_AUTO_LIMIT` left in place — see "Config hygiene (deferred)".
- Prisma 7 has **no exported `Prisma.TransactionClient`** type — `AuditService.record` accepts an untyped `db` sink; TicketService passes the in-tx client so audit rows commit/roll back with the workflow.
- Decision gate is run against **lowercase** `order.status` (`'delivered'`); Prisma ticket enums (`intent`/`priority`) are stored **uppercase** via `toUpperCase()` at the boundary.
- `Refund.ticketId` is **already `@unique`** (line 162, "one refund per ticket") — no Phase 7 migration; idempotency is `findUnique`-then-create inside the tx.
- `processTicket` creates the ticket row **before** `$transaction` (deliberate deviation from the task snippet) so a rolled-back workflow can still persist `status: FAILED`; audit `TICKET_CREATED` remains inside the tx.
- `TicketController` result interfaces (`ProcessResult`/`RefundResult`/`ApprovalResult`/`TicketResult`) are exported because Nest/TS requires return types of controller methods to be nameable.
- The only server-log error during Phase 7 verification is the pre-existing `ObserveAgentWorker` telemetry 401 (placeholder credentials) — not a workflow regression.
- JwtAuthGuard checks `IS_PUBLIC_KEY` via `getAllAndOverride` (handler, then class) and verifies the JWT with `JwtService` directly (the documented pattern) rather than extending `AuthGuard('jwt')`.
- `@Public()` and `@Roles` must never coexist on the same route: JwtAuthGuard is bypassed by `@Public()` but RolesGuard still runs and would 403 every request (no `request.user`).
- `ApprovalRequest.decidedById` is a `User` FK (cuid), so `approve/reject` look up the decider by the JWT email and store the user id; the email goes into audit metadata.
- Prisma model is `ApprovalRequest` (not `approval`); list uses `prisma.approvalRequest.findMany`.
- **`TicketService.processTicket` was restructured (Phase 9 prep) to keep DB transactions short.** LLM classification, RAG retrieval, and response generation now run **outside** any transaction. DB transactions only wrap write-side effects, each sub-second.

  Before: single transaction wrapping the whole workflow. Failed with real Ollama after 27s due to Prisma's 5s interactive transaction timeout.

  After: phase-split — create ticket (short tx) → classify (no tx) → RAG (no tx) → order lookup (no tx) → decision (no tx) → side effects (short tx) → response generation (no tx) → final writes (short tx).

  Failure path: if any non-DB phase fails, the ticket is marked `FAILED` and audit `TICKET_FAILED` recorded in its own short transaction; the error is returned in the `ProcessResult` (same return-not-rethrow contract as before).

  Recovery: `GET /tickets/:id` shows the `FAILED` ticket with any committed side effects in the audit log. Phase 9 hardening item: a retry endpoint (or background reconciliation) that re-runs the late phases for `FAILED` tickets without re-creating side effects (idempotent by `ticketId`).

  This keeps DB locks off the LLM latency path and is the correct shape for production. New audit event `TICKET_FAILED` fires only on failure; success trace adds `ORDER_STATUS_TRANSITIONED` (Phase 8), making the AUTO_REFUND path 9 events.

## Next Step

Phase 9 — Production quality (error handling hardening, retry, rate limiting, Dockerized app). Phase 2 follow-up (live LLM verify via `AI_CHAT_MODEL=qwen2.5:7b` + Ollama) remains open.
