# Project Roadmap

## Phase 1 — Foundation ✅

- [x] Create repository
- [x] Setup backend — NestJS 12, TypeScript 6, ESM
- [x] Setup database — PostgreSQL 16 via Docker Compose (`pgvector/pgvector:pg16`, container `ai-support-postgres`)
- [x] Define schema (`prisma/schema.prisma`, 10 tables) + apply migrations (`init`, `knowledge_filename_unique`, `reconcile_embedding_dims_768`, `add_order_refunded_status`)
- [x] Seed database (3 customers, 5 orders, 2 staff users, 3 knowledge docs)
- [x] Observability (NestJS Observe), lint (oxlint), format (Prettier), tests (Vitest)

## Phase 2 — Business Data & API ✅

- [x] Customer model + CRUD API (`/customers`)
- [x] Order model + CRUD API (`/orders`, `GET /orders/:id` verified)
- [x] Refund model + API (`/refunds`, fake provider, idempotent per ticket)
- [x] User model + admin CRUD API (`/users`, bcrypt-hashed passwords)
- [x] DTO validation (class-validator) + PrismaModule/Service (driver adapter `PrismaPg`)

## Phase 3 — Auth Foundation ✅

- [x] JWT auth module (`/auth`: register, login, refresh, logout, me)
- [x] Refresh-token rotation (hash stored, never the raw token)
- [x] `@Public()` and `@CurrentUser()` decorators
- [x] Global auth guards — `JwtAuthGuard` + `RolesGuard` via `APP_GUARD` in `AuthModule`; `@Public()` opt-outs live; curl-verified

## Phase 4 — Support Tickets & AI Classification

- [x] AI provider abstraction (`src/ai/`, mock default + OpenAI-compatible via `fetch`) with zod-validated structured classification + confidence
- [x] Support ticket API
- [ ] Verify against a live local LLM (provider wired, `AI_CHAT_MODEL=qwen2.5:7b`)

## Phase 5 — RAG ✅

- [x] Chunk knowledge documents (schema + seed present)
- [x] Generate embeddings (pgvector column exists via raw SQL)
- [x] Store vectors
- [x] Implement retrieval
- [ ] Add context to LLM (Phase 6/7 wiring)

## Phase 6 — AI Decision Engine ✅

- [x] Define actions — `DecisionAction` / `DecisionReason` contract (`src/decision/types.ts`)
- [x] Validate AI decisions — pure `evaluateDecision` (intent/confidence/delivered/window/amount gates)
- [ ] Implement tool calling
- [ ] Add safety rules
- [x] DecisionModule wired (no controller — exposed via ticket workflow in Phase 7)

## Phase 7 — Automation ✅

- [x] Automatic refund
- [x] Automatic response
- [x] Human escalation
- [x] Audit logging

## Phase 8 — Business Rules ✅

- [x] Refund eligibility (limits/window configurable in `.env`; `hasCompletedRefund` + already-refunded wrinkle)
- [x] Order status transitions (`REFUNDED` + `refundedAt`)
- [x] Approval workflow (`/approvals` list/approve/reject, schema present)

## Phase 9 — Production Quality

- [ ] Error handling hardening
- [ ] Retry handling
- [x] Authentication guards live (`JwtAuthGuard` + `RolesGuard` via `APP_GUARD`, `@Public()` opt-outs)
- [ ] Rate limiting
- [ ] Dockerized app (only DB via Docker today)
