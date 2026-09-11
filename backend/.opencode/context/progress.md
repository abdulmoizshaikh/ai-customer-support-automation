# Project Progress

## Current Stage

**Phases 1–6 complete; Phases 7–9 pending**

### Completed

- [x] Repository created
- [x] Backend scaffolded — NestJS 12, TypeScript 6, ESM
- [x] Database — PostgreSQL 16 via Docker Compose (`pgvector/pgvector:pg16`, container `ai-support-postgres`, volume `backend_postgres_data`)
- [x] Prisma 7 stable + driver adapter (`@prisma/adapter-pg` / `PrismaPg`), classic `schema.prisma`
- [x] 10-table schema + migrations applied (`init`, `knowledge_filename_unique`, `reconcile_embedding_dims_768`)
- [x] Seed data loaded — 3 customers, 5 orders (123/124/125, 456, 789), 2 staff users (admin + agent), 3 knowledge docs
- [x] `CustomersModule`, `OrdersModule`, `RefundsModule`, `UsersModule`, `AuthModule`, `PrismaModule`, `EmbeddingsModule`, `RagModule`, `DecisionModule` all wired into `AppModule`
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

### Pending / Phase 3 follow-up

- [ ] Register `JwtAuthGuard` globally via `APP_GUARD` in `AuthModule`, with a `@Public()` decorator opt-out for `/auth/login` and `/auth/register`.
- [ ] Register `RolesGuard` globally after `JwtAuthGuard` so `@Roles(...)` metadata is actually enforced.
- [ ] Verify `GET /orders/:id` returns 401 without a JWT once guards are live, then re-verify with a JWT from `POST /auth/login`.

### Config hygiene (deferred)

- [ ] `REFUND_AUTO_LIMIT` is currently read by **no code** — candidate for removal once Phase 7 confirms the ticket workflow reads only `AUTO_REFUND_THRESHOLD`.
- [ ] Re-verify at the end of Phase 7 that no config consumer reads the legacy var.

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

## Next Step

Phase 7 — Automation (automatic refund, automatic response, human escalation, audit logging) + wire the ticket workflow (AI classify → RAG retrieval → decision engine → action). Phase 4 follow-ups (support-ticket API, live LLM verify) remain open.
