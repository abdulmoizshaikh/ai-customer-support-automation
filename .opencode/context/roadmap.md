# Project Roadmap

## Phase 1 — Foundation ✅

- [x] Create repository
- [x] Setup backend — NestJS 12, TypeScript 6, ESM
- [x] Setup database — PostgreSQL 16 via Docker Compose (`pgvector/pgvector:pg16`, container `ai-support-postgres`)
- [x] Define schema (`prisma/schema.prisma`, 10 tables) + apply migrations (`init`, `knowledge_filename_unique`)
- [x] Seed database (3 customers, 5 orders, 2 staff users, 3 knowledge docs)
- [x] Observability (NestJS Observe), lint (oxlint), format (Prettier), tests (Vitest)

## Phase 2 — Business Data & API ✅

- [x] Customer model + CRUD API (`/customers`)
- [x] Order model + CRUD API (`/orders`, `GET /orders/:id` verified)
- [x] Refund model + API (`/refunds`, fake provider, idempotent per ticket)
- [x] User model + admin CRUD API (`/users`, bcrypt-hashed passwords)
- [x] DTO validation (class-validator) + PrismaModule/Service (driver adapter `PrismaPg`)

## Phase 3 — Auth Foundation ✅ (follow-ups pending)

- [x] JWT auth module (`/auth`: register, login, refresh, logout, me)
- [x] Refresh-token rotation (hash stored, never the raw token)
- [x] `@Public()` and `@CurrentUser()` decorators

## Phase 4 — Support Tickets & AI Classification

- [x] AI provider abstraction (`src/ai/`, mock default + OpenAI-compatible via `fetch`) with zod-validated structured classification + confidence
- [ ] Support ticket API
- [ ] Verify against a live local LLM (provider wired, `AI_CHAT_MODEL=qwen2.5:7b`)

## Phase 5 — RAG

- [ ] Chunk knowledge documents (schema + seed present)
- [ ] Generate embeddings (pgvector column exists via raw SQL)
- [ ] Store vectors
- [ ] Implement retrieval
- [ ] Add context to LLM

## Phase 6 — AI Decision Engine

- [ ] Define actions
- [ ] Validate AI decisions
- [ ] Implement tool calling
- [ ] Add safety rules

## Phase 7 — Automation

- [ ] Automatic refund
- [ ] Automatic response
- [ ] Human escalation
- [ ] Audit logging

## Phase 8 — Business Rules

- [ ] Refund eligibility (limits/window already configurable in `.env`)
- [ ] Order status transitions
- [ ] Approval workflow (schema present)

## Phase 9 — Production Quality

- [ ] Error handling hardening
- [ ] Retry handling
- [ ] Authentication guards live (see progress.md follow-ups)
- [ ] Rate limiting
- [ ] Dockerized app (only DB via Docker today)
