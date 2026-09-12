# AI Customer Support Automation Platform

A locally-hosted AI automation system that classifies customer support tickets, retrieves company policies via RAG (Retrieval-Augmented Generation), evaluates deterministic business rules, executes low-risk actions automatically, and routes high-risk actions through human approval — with every step recorded in an auditable execution trace.

Built as a demonstration of **real backend automation** (not a chatbot wrapper): LLM → structured output → RAG → tools → business rules → action → human approval → audit log.

---

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [The Full Workflow](#the-full-workflow)
- [Development Phases](#development-phases)
- [Directory Layout](#directory-layout)
- [Running Locally](#running-locally)
- [Backend Configuration](#backend-configuration)
- [Environment Files](#environment-files)
- [Verification and Testing](#verification-and-testing)
- [Real LLM vs Mock Providers](#real-llm-vs-mock-providers)
- [Key Design Principles](#key-design-principles)
  **Part 6 — Technical Deep Dive**
- [Why RAG and Not Fine-Tuning?](#1-why-rag-and-not-fine-tuning)
- [Embedding Model Selection](#2-embedding-model-selection--why-nomic-embed-text)
- [Similarity Metric — Why Cosine](#3-similarity-metric--why-cosine-and-not-dot-product-or-euclidean)
- [Chunking Strategy](#4-chunking-strategy--why-headings--overlap)
- [Structured Output — Why zod](#5-structured-output--why-zod-and-not-just-prompting)
- [Temperature Choices](#6-temperature--why-0-for-classification-and-02-for-response)
- [Mock Providers — Why Functional](#7-mock-providers--why-not-just-stub-them)
- [Structured Output vs Tool Calling](#8-structured-output-vs-tool-calling--why-not-function-calling)
- [Confidence Thresholds](#9-confidence-thresholds--why-085)
- [Idempotency](#10-why-idempotency-matters--and-how-its-enforced)
- [Short Transactions](#11-why-short-transactions--and-the-bug-that-forced-the-refactor)
- [Structured Audit Trails](#12-why-audit-trails-are-structured--not-just-logs)
- [Provider Abstraction](#13-provider-abstraction--why-both-aiprovider-and-embeddingprovider)
- [Security Decisions](#14-security-decisions--why-jwt-why-roles-why-rate-limiting)
- [Observability](#15-observability--what-would-you-add-for-production)
- [Testing Strategy](#16-testing-strategy--why-unit--e2e-why-mock-providers)
- [What I'd Do Differently](#17-what-id-do-differently-in-production)
- [Cheat Sheet](#18-cheat-sheet--key-numbers-and-parameters)
- [Common Interview Questions](#19-common-interview-questions--prepared-answers)
- [Summary](#20-summary--what-makes-this-a-real-ai-automation-system)
- [Known Issues and Roadmap](#known-issues-and-roadmap)

---

## Why This Project Exists

Most "AI automation" projects are chat wrappers: prompt in, text out, no structure, no safety, no audit trail. That's fine for a demo but doesn't reflect how production automation works.

This project demonstrates the complete workflow that a **real AI automation system** needs:

- **Structured AI output** — the LLM returns validated JSON, not free-form text.
- **Retrieval-Augmented Generation** — the LLM reasons over company-specific policies, not general knowledge.
- **Deterministic business rules** — the LLM never decides whether a refund is allowed; code does.
- **Human-in-the-loop** — high-risk actions require human approval.
- **Idempotency** — the same request twice never produces duplicate side effects.
- **Auditability** — every step is logged with structured metadata.

The core architectural principle: **AI reasons; code decides.**

---

## Architecture Overview

```text
                    ┌─────────────────────┐
                    │   Customer / Agent  │
                    │   (HTTP client)     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    NestJS API       │
                    │  (REST + JWT auth)  │
                    └──────────┬──────────┘
                               │
                       POST /tickets
                               │
                               ▼
                    ┌─────────────────────┐
                    │  AI Classifier      │
                    │  (LLM + zod schema) │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼──────────────────┐
             ▼                 ▼                  ▼
       Intent/OrderId      RAG Search        Priority
       (structured)        (pgvector)        (structured)
             │                 │                  │
             └─────────────────┼──────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  Decision Engine    │
                    │  (deterministic)    │
                    └──────────┬──────────┘
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
                Safe Action        Human Approval
                     │                   │
                     ▼                   ▼
              Refund Service       Agent reviews
                     │             via /approvals
                     │                   │
                     └─────────┬─────────┘
                               ▼
                    ┌─────────────────────┐
                    │  Audit Log          │
                    │  (execution trace)  │
                    └─────────────────────┘
```

---

## Technology Stack

**Backend**

- Node.js 24
- TypeScript (ESM, `moduleResolution: nodenext`)
- NestJS
- Prisma 7 (with driver adapter)
- PostgreSQL 16 + pgvector

**AI**

- Ollama (local LLM runtime)
- `qwen2.5:7b` — classification and response generation
- `nomic-embed-text` — 768-dim embeddings for RAG
- OpenAI-compatible HTTP adapter (works with Ollama, OpenAI, OpenRouter, etc.)

**Frontend (planned, Phase 10)**

- React + TypeScript

**Infrastructure**

- Docker Compose (PostgreSQL with pgvector)
- Vitest for tests
- oxlint for linting

---

## The Full Workflow

When a customer submits a ticket:

```text
POST /tickets { "message": "My order #123 arrived damaged. I want a refund." }
  │
  ├─ 1. Create ticket (status: OPEN)
  │     └─ Audit: TICKET_CREATED (actor: HUMAN)
  │
  ├─ 2. AI classifies the message
  │     └─ Output: { intent, orderId, priority, confidence } (zod-validated)
  │     └─ Audit: AI_CLASSIFICATION (actor: AI, provider: "openai"|"mock")
  │
  ├─ 3. RAG retrieves relevant policy chunks
  │     └─ Query embedding → pgvector cosine similarity → top-K chunks
  │     └─ Audit: RAG_RETRIEVED (chunkCount, topScore, filenames)
  │
  ├─ 4. Order lookup
  │     └─ Audit: ORDER_LOOKED_UP (found, amount, status)
  │
  ├─ 5. Decision engine evaluates (pure function, no AI)
  │     ├─ Intent check
  │     ├─ Confidence threshold check
  │     ├─ Order existence
  │     ├─ Refund wrinkles (already refunded? outside window? not delivered?)
  │     ├─ Amount threshold ($500)
  │     └─ Audit: DECISION_MADE (action, reason, amount, requiresApproval)
  │
  ├─ 6. Branch on decision.action
  │     │
  │     ├─ AUTO_REFUND ─────────────► Create refund (COMPLETED)
  │     │                              Transition order → REFUNDED
  │     │                              Audit: REFUND_CREATED
  │     │                              Audit: ORDER_STATUS_TRANSITIONED
  │     │
  │     ├─ REQUEST_HUMAN_APPROVAL ──► Create ApprovalRequest (PENDING)
  │     │                              Ticket status → WAITING_APPROVAL
  │     │                              Audit: APPROVAL_REQUESTED
  │     │
  │     ├─ REJECT_REFUND ───────────► No side effect
  │     ├─ ORDER_NOT_FOUND ─────────► No side effect
  │     └─ NO_ACTION ───────────────► No side effect
  │
  ├─ 7. Generate customer response (LLM)
  │     └─ Context: original message + decision + policy chunks
  │     └─ Audit: RESPONSE_GENERATED (action, length)
  │
  └─ 8. Resolve ticket
        └─ Audit: TICKET_RESOLVED (finalStatus)
```

For high-value tickets, the flow pauses at `WAITING_APPROVAL` and resumes when an agent approves:

```text
POST /approvals/:id/approve  (requires JWT, role AGENT or ADMIN)
  │
  ├─ Load approval, validate PENDING
  ├─ Create refund (COMPLETED)
  ├─ Transition order → REFUNDED
  ├─ Update ticket → RESOLVED
  └─ Audit: APPROVAL_APPROVED, ORDER_STATUS_TRANSITIONED, TICKET_RESOLVED
```

---

## Development Phases

The project was built in ten phases. Each phase added a distinct capability while preserving all prior functionality.

### Phase 1 — Backend Foundation

**Goal:** NestJS + PostgreSQL + Prisma with a schema covering all domain entities.

**What was built:**

- NestJS project with TypeScript
- Prisma 7 with driver adapter (deliberately chose stable over Prisma 8 RC)
- PostgreSQL 16 running via Docker Compose (`pgvector/pgvector:pg16`)
- Schema: `Customer`, `Order`, `Ticket`, `Refund`, `ApprovalRequest`, `AuditLog`, `KnowledgeDocument`, `KnowledgeChunk`, `User`
- Seed data covering all decision scenarios (auto-refund, high-value approval, outside window, not found)

**Files:** `prisma/schema.prisma`, `prisma/seed.ts`, `docker-compose.yml`

---

### Phase 2 — Core API

**Goal:** Standard REST endpoints for orders, customers, refunds — before any AI.

**What was built:**

- `GET /orders/:id` — fetch order with customer
- `POST /refunds` — create refund (later became idempotent by ticketId)
- `GET /customers` — customer listing
- Global `ValidationPipe` with `class-validator`

**Why before AI:** Proved the ordinary backend works first. The AI layer builds on top.

**Files:** `src/orders/`, `src/customers/`, `src/refunds/`

---

### Phase 3 — Authentication

**Goal:** JWT-based auth with role-based access control.

**What was built:**

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- `JwtAuthGuard` and `RolesGuard`
- `@Public()` decorator for opt-out
- `@Roles(...)` decorator for endpoint-level role gating
- Roles: `CUSTOMER`, `AGENT`, `ADMIN`

**Note:** Guards were built in Phase 3 but **globally registered** during Phase 8 cleanup.

**Files:** `src/auth/`, `src/users/`, `src/common/guards/`, `src/common/decorators/`

---

### Phase 4 — AI Classification Layer

**Goal:** A provider-agnostic AI abstraction with validated structured output.

**What was built:**

- `AIProvider` interface with `classifyTicket(message)` method
- `MockProvider` — deterministic, no network, always available
- `OpenAICompatibleProvider` — plain `fetch`, reads env vars, works with Ollama/OpenAI/OpenRouter
- `TicketClassificationSchema` (zod) — validates LLM output before it's used anywhere
- `POST /ai/classify` — dev/test endpoint

**The critical rule:** LLM output is never trusted raw. It's parsed through a zod schema. If the schema fails, the request fails loudly — no silent garbage propagation.

```typescript
// Conceptual flow
const raw = await llm(message);
const parsed = TicketClassificationSchema.safeParse(raw);
if (!parsed.success) throw new Error("Invalid classification");
return parsed.data; // typed, validated
```

**Files:** `src/ai/`

---

### Phase 5 — RAG (Retrieval-Augmented Generation)

**Goal:** Let the LLM reason over company policies, not general knowledge.

**What was built:**

- `EmbeddingProvider` interface mirroring `AIProvider`
- `MockEmbeddingProvider` — deterministic token-hash bag-of-words (produces meaningful positive cosine scores)
- `OpenAICompatibleEmbeddingProvider` — reads `nomic-embed-text` via Ollama
- `chunkMarkdown()` — splits policy documents on headings with overlap
- `RagService.ingestDocument()` — idempotent by filename (replace on re-ingest)
- `RagService.searchKnowledge()` — pgvector cosine similarity search
- `POST /knowledge` — ingest a policy document
- `GET /knowledge/search?q=...` — similarity search

**Schema:** `KnowledgeChunk.embedding` is `Unsupported("vector(768)")`, matching `nomic-embed-text`'s output dimension.

**Design principle:** Ingestion is idempotent by filename. Re-ingesting a policy replaces it — including its chunks (via CASCADE).

**Files:** `src/embeddings/`, `src/rag/`

---

### Phase 6 — Decision Engine

**Goal:** Deterministic, testable, dependency-free business rule evaluation.

**What was built:**

- `evaluateDecision(input): Decision` — pure function, no Prisma, no HTTP, no AI
- `DEFAULT_POLICY` — 30-day window, $500 threshold, 0.85 confidence
- `getPolicyFromEnv()` — overridable via env vars
- 16 scenario test cases covering every branch and boundary

**The output contract:**

```typescript
type DecisionAction =
  | "AUTO_REFUND"
  | "REQUEST_HUMAN_APPROVAL"
  | "REJECT_REFUND"
  | "ORDER_NOT_FOUND"
  | "NEEDS_HUMAN_REVIEW"
  | "NO_ACTION";
```

**Boundary cases baked into tests:**

- $500.00 → auto-refund; $500.01 → approval
- 30 days → refund; 31 days → reject
- Confidence 0.85 → proceed; 0.84 → human review

**This is where the "AI reasons, code decides" principle becomes concrete.** The LLM says "this looks like a refund request." The decision engine says "this order is 45 days old — reject."

**Files:** `src/decision/`

---

### Phase 7 — Ticket Workflow Orchestration

**Goal:** Tie every subsystem together into a single atomic workflow.

**What was built:**

- `TicketService.processTicket(message, customerId?)` — the orchestrator
- `AuditService.record(ticketId, event, actor, metadata, tx?)` — transaction-aware audit writer
- `AiService.generateCustomerResponse(context)` — second LLM call, uses RAG chunks as context
- `POST /tickets` — the primary entry point
- `GET /tickets` and `GET /tickets/:id` — with full audit trace included
- Deterministic mock response templates keyed by decision action

**The execution trace** — this is what makes the system auditable:

```json
[
  { "event": "TICKET_CREATED", "actor": "HUMAN" },
  {
    "event": "AI_CLASSIFICATION",
    "actor": "AI",
    "metadata": { "provider": "openai", "confidence": 0.9 }
  },
  {
    "event": "RAG_RETRIEVED",
    "actor": "SYSTEM",
    "metadata": { "chunkCount": 1, "filenames": ["refund-policy.md"] }
  },
  { "event": "ORDER_LOOKED_UP", "actor": "SYSTEM" },
  {
    "event": "DECISION_MADE",
    "actor": "SYSTEM",
    "metadata": { "action": "AUTO_REFUND" }
  },
  { "event": "REFUND_CREATED", "actor": "SYSTEM" },
  { "event": "ORDER_STATUS_TRANSITIONED", "actor": "SYSTEM" },
  { "event": "RESPONSE_GENERATED", "actor": "AI" },
  { "event": "TICKET_RESOLVED", "actor": "SYSTEM" }
]
```

**Files:** `src/tickets/`, `src/audit/`

---

### Phase 8 — Human-in-the-Loop Approvals

**Goal:** Make the approval workflow actually actionable, enforce auth globally, close refund wrinkles.

**What was built:**

**Part 1 — Global auth enforcement:**

- Registered `JwtAuthGuard` then `RolesGuard` via `APP_GUARD` in `AuthModule`
- `@Public()` opt-out applied to customer-facing endpoints (`POST /tickets`, `/ai`, `/knowledge`)
- `@Roles(AGENT, ADMIN)` now actually enforced on approvals (was inert)

**Part 2 — Approval workflow:**

- `GET /approvals?status=PENDING` — list pending approvals
- `POST /approvals/:id/approve` — creates refund, resolves ticket, audits the decision
- `POST /approvals/:id/reject` — resolves ticket with `via: 'human-rejection'`
- All operations wrapped in a short transaction

**Part 3 — Refund wrinkles:**

- Added `Order.refundedAt` field
- Decision engine rejects refunds when the order is already `REFUNDED` or has a `COMPLETED` refund
- New `DecisionReason.ORDER_ALREADY_REFUNDED`

**Files:** `src/approvals/`

---

### Phase 9 — Hardening and Observability _(planned)_

**Planned scope:**

- `POST /admin/seed-test-order` — for repeatable manual verification
- `POST /tickets/:id/retry` — recovery path for FAILED tickets
- Rate limiting via `@nestjs/throttler`
- `GET /analytics` — automation rate, escalation counts, avg confidence
- End-to-end test against a real database
- RAG similarity investigation (short-query low scores)

---

### Phase 10 — React Dashboard _(planned)_

**Planned screens:**

- Customer ticket submission form
- Ticket list with intent, priority, status
- Approval queue with one-click approve/reject
- Ticket detail with full AI execution trace visualization

---

## Directory Layout

```text
ai-customer-support/
├── backend/                        ← NestJS application
│   ├── prisma/
│   │   ├── schema.prisma           ← data model
│   │   ├── seed.ts                 ← seed data
│   │   └── migrations/             ← migration history
│   ├── src/
│   │   ├── ai/                     ← Phase 4: classification
│   │   ├── approvals/              ← Phase 8: human-in-the-loop
│   │   ├── audit/                  ← Phase 7: execution trace
│   │   ├── auth/                   ← Phase 3: JWT + roles
│   │   ├── common/                 ← guards, decorators, config
│   │   ├── customers/              ← Phase 2
│   │   ├── decision/               ← Phase 6: business rules
│   │   ├── embeddings/             ← Phase 5: vector embeddings
│   │   ├── orders/                 ← Phase 2
│   │   ├── rag/                    ← Phase 5: retrieval
│   │   ├── refunds/                ← Phase 2, extended in 8
│   │   ├── tickets/                ← Phase 7: orchestrator
│   │   └── users/                  ← Phase 3
│   ├── .env.example                ← documented env vars
│   ├── .env.mock-backup            ← provider= mock snapshot
│   └── .env.openai-backup          ← provider= openai snapshot
├── docker-compose.yml              ← PostgreSQL + pgvector
├── knowledge/                      ← policy documents (markdown)
└── README.md                       ← this file
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- Ollama (optional — only for real-LLM mode)

### Setup

```bash
# 1. Start PostgreSQL with pgvector
docker compose up -d

# 2. Install backend deps
cd backend
npm install

# 3. Apply migrations and seed
npx prisma migrate deploy
npx prisma db seed

# 4. Start dev server
npm run start:dev
```

### Test the workflow

```bash
# Mock provider (default, no external services needed)
curl -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d '{"message":"My order #124 arrived damaged. I want a refund."}'

# Response includes classification, decision, refund, response, and audit trace
```

### Real LLM mode (Ollama)

```bash
# 1. Install models
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 2. Switch providers
cp .env.openai-backup .env

# 3. Restart server
npm run start:dev

# 4. Submit a ticket — expect 15-30s (real inference)
```

### Docker Compose (Full Stack)

Runs PostgreSQL, the backend, and the frontend in containers.

**Prerequisites:**

- Docker + Docker Compose v2
- (Optional, for real LLM) Ollama running on the host

**Steps:**

```bash
# 1. Create your .env from the example
cp .env.example .env
# Edit .env if you want real LLM (AI_PROVIDER=openai) or changed secrets

# 2. Build and start the full stack
docker compose up --build

# 3. Open the dashboard
open http://localhost:5173
# Backend API: http://localhost:3000
```

**Stopping:**

```bash
docker compose down          # stop and remove containers
docker compose down -v       # ALSO remove the database volume (destructive)
```

**Rebuilding after code changes:**

```bash
docker compose up --build
```

**Logs:**

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

**Notes:**

- Migrations and seed run automatically on backend startup.
- Ollama must run on the host (not in a container). The backend reaches it via `host.docker.internal:11434`.
- The database volume (`backend_postgres_data`) persists across restarts.
- To reset the database: `docker compose down -v` then `docker compose up --build`.

**Local dev still works** without Docker for the app:

```bash
docker compose up postgres   # only the database
cd backend && npm run start:dev
cd frontend && npm run dev
```

---

## Backend Configuration

All config lives in `.env`. See `.env.example` for the full set.

**Core**

```env
DATABASE_URL="postgresql://ai_support:ai_support@localhost:5432/ai_support?schema=public"
PORT=3000
```

**Auth**

```env
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
```

**AI provider**

```env
AI_PROVIDER=mock                  # mock | openai
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=                       # empty → falls back to "ollama"
AI_CHAT_MODEL=qwen2.5:7b
```

**Embeddings**

```env
EMBEDDING_PROVIDER=mock           # mock | openai
AI_EMBED_MODEL=nomic-embed-text
EMBEDDING_DIMS=768
```

**Business rules**

```env
REFUND_WINDOW_DAYS=30
AUTO_REFUND_THRESHOLD=500
CONFIDENCE_THRESHOLD=0.85
```

### Switching Between Mock and Real Providers

Keep two named snapshots for deterministic switching:

```bash
# To real (Ollama):
cp .env.openai-backup .env

# To mock (default, offline):
cp .env.mock-backup .env
```

**Never use `sed` to flip providers.** A line-concatenation bug in an earlier session corrupted `CONFIDENCE_THRESHOLD`. The `cp` pattern is deterministic.

---

## Environment Files

The project uses **three `.env` files**, each serving a distinct purpose. They are not redundant — each one is read by a different tool in a different context.

| File                  | Read by                | Purpose                                                          |
| --------------------- | ---------------------- | ---------------------------------------------------------------- |
| `.env` (project root) | `docker compose`       | Variable interpolation for `docker-compose.yml`                  |
| `backend/.env`        | NestJS (host dev mode) | Backend configuration when running `npm run start:dev` locally   |
| `frontend/.env`       | Vite (host dev mode)   | Frontend build-time variables when running `npm run dev` locally |

All three files are **gitignored**. Each has a corresponding `.env.example` (committed) that documents the required variables.

---

### 1. Root `.env` — Docker Compose Configuration

**Location:** `ai-customer-support/.env`

**Read by:** `docker compose` commands run from the project root.

**Purpose:** Docker Compose performs variable substitution on `docker-compose.yml` at parse time. Every `${VAR}` reference in the compose file is replaced with the value from this file.

**Example variables:**

```env
POSTGRES_USER=ai_support
POSTGRES_PASSWORD=ai_support
POSTGRES_DB=ai_support
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
AI_PROVIDER=mock
EMBEDDING_PROVIDER=mock
BACKEND_PORT=3000
FRONTEND_PORT=5173
```

**How it flows into containers:**

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      AI_PROVIDER: ${AI_PROVIDER}
```

Compose resolves `${POSTGRES_USER}` etc. from the root `.env` and passes the resolved values into the container's environment.

**Important:** This file is **never read by NestJS or Vite directly**. It only exists for Compose to do its interpolation. The containerized backend never reads `backend/.env` — it receives environment variables from Compose at container start.

**When you use it:**

```bash
docker compose up --build
docker compose ps
docker compose logs backend
```

---

### 2. `backend/.env` — Backend Development

**Location:** `ai-customer-support/backend/.env`

**Read by:** NestJS when you run the backend on the host (not in Docker).

**Purpose:** Provides all configuration the backend needs during local development. NestJS reads this file via `dotenv` on startup.

**Example variables:**

```env
DATABASE_URL="postgresql://ai_support:ai_support@localhost:5432/ai_support?schema=public"
PORT=3000
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
AI_PROVIDER=mock
AI_BASE_URL=http://localhost:11434/v1
AI_CHAT_MODEL=qwen2.5:7b
AI_EMBED_MODEL=nomic-embed-text
EMBEDDING_DIMS=768
EMBEDDING_PROVIDER=mock
REFUND_WINDOW_DAYS=30
AUTO_REFUND_THRESHOLD=500
CONFIDENCE_THRESHOLD=0.85
```

**Key difference from the root `.env`:** the `DATABASE_URL` points to `localhost:5432`, not `postgres:5432`. This is because the host machine reaches the Docker PostgreSQL container through the mapped port, whereas the Docker backend reaches it through the Compose network alias.

**When you use it:**

```bash
cd backend
npm run start:dev       # hot-reload dev server
npm test                # unit tests
npx prisma migrate dev  # apply migrations in dev
npx prisma studio       # browse the database
```

**Why we don't delete it:**

Running the backend on the host is **10–100× faster** than rebuilding a Docker image after each code change. During active development, you'll use this file 90% of the time. Docker mode is for demos, CI, and production-like verification — not the daily edit-test loop.

**Provider snapshots:**

Two additional files exist as deterministic provider-switching helpers:

| File                         | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| `backend/.env.mock-backup`   | Copy of `.env` with mock providers (default) |
| `backend/.env.openai-backup` | Copy of `.env` with real Ollama providers    |

Switch with a single command:

```bash
cp .env.mock-backup .env      # offline, deterministic, fast tests
cp .env.openai-backup .env    # real qwen2.5:7b + nomic-embed-text
```

**Never edit these files with `sed`.** A line-concatenation bug in an earlier session corrupted `CONFIDENCE_THRESHOLD`; the `cp` pattern is deterministic.

---

### 3. `frontend/.env` — Frontend Development

**Location:** `ai-customer-support/frontend/.env`

**Read by:** Vite when running the frontend on the host.

**Purpose:** Provides build-time variables for the frontend, prefixed with `VITE_`. Vite exposes them to client code via `import.meta.env`.

**Example variables:**

```env
# (if used)
VITE_API_URL=http://localhost:3000
VITE_ENVIRONMENT=development
```

**Why this file might be empty or minimal:**

The frontend is designed to use **relative `/api/*` paths** rather than absolute backend URLs. In both dev mode (via the Vite proxy in `vite.config.ts`) and production mode (via the nginx proxy in `nginx.conf`), the prefix `/api` is rewritten and forwarded to the backend.

This means the frontend doesn't need to know the backend's host or port — it just calls `/api/tickets` and lets the proxy handle the rest. As a result, `frontend/.env` may not need any variables at all for a basic setup.

**When you use it:**

```bash
cd frontend
npm run dev     # Vite dev server on :5173
npm run build   # production build
```

**Why we don't delete it:**

Even if currently unused, the file is a **documented extension point**. Any future feature that needs environment-specific behavior (analytics IDs, feature flags, external API keys) has a clear place to live. Deleting it would force that decision to be made again later.

**Not read by Docker.** The production frontend image serves static files via nginx; runtime environment variables don't apply to the build output.

---

### How the Three Files Interact (Visual)

```text
DEV MODE (host)                          DOCKER MODE (compose)
─────────────────                        ─────────────────────

cd backend                               docker compose up
   │                                        │
   │ reads                                  │ reads
   ▼                                        ▼
backend/.env                             .env (root)
   │                                        │
   │ provides                               │ interpolates
   ▼                                        ▼
NestJS on :3000                          docker-compose.yml
                                            │
cd frontend                                 │ passes via
   │                                        │ environment:
   │ reads                                  ▼
   ▼                                     backend container
frontend/.env                            frontend container
   │                                        │
   │ provides                               │ reads
   ▼                                        ▼
Vite on :5173                            container env vars
                                            │
                                            ▼
                                         running services
```

**No file shadows another.** Each is read by exactly one tool in exactly one mode.

---

### Keeping Them in Sync

Some values appear in more than one file:

| Value                               | Root `.env` |    `backend/.env`    |
| ----------------------------------- | :---------: | :------------------: |
| `JWT_ACCESS_SECRET`                 |      ✓      |          ✓           |
| `JWT_REFRESH_SECRET`                |      ✓      |          ✓           |
| `AI_PROVIDER`                       |      ✓      |          ✓           |
| `POSTGRES_USER` / `PASSWORD` / `DB` |      ✓      | (via `DATABASE_URL`) |

When you change a shared value (e.g., rotate the JWT secret), update **both files**. There's no automatic sync; the duplication is a consequence of how Compose and host-based tools consume configuration.

**Sync checklist when changing shared values:**

```bash
# 1. Update root .env
vim .env

# 2. Update backend/.env with the same value
vim backend/.env

# 3. Update the backup snapshots
cp backend/.env backend/.env.mock-backup   # (edit providers back if needed)
```

For a solo project, this is manageable. For a team, consider a secret manager (1Password CLI, Doppler, AWS Secrets Manager) with a single source of truth.

---

### Which File Do I Edit?

| Situation                                        | File to edit                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Changing the port the frontend runs on (Docker)  | root `.env` → `FRONTEND_PORT`                                         |
| Changing JWT TTL for local dev                   | `backend/.env` → `JWT_ACCESS_TTL`                                     |
| Rotating the JWT secret                          | Both root `.env` AND `backend/.env`                                   |
| Switching AI providers for tests                 | `cp backend/.env.mock-backup backend/.env`                            |
| Switching AI providers for real-LLM verification | `cp backend/.env.openai-backup backend/.env`                          |
| Adding a Vite environment variable               | `frontend/.env`                                                       |
| Changing DB credentials                          | Root `.env` (affects container) AND `backend/.env` (affects host dev) |

---

### Why We Don't Consolidate to a Single `.env`

Tempting, but it doesn't work cleanly:

- **Root `.env` uses container hostnames** (`postgres:5432`), while dev mode needs hostnames reachable from the host machine (`localhost:5432`). One file can't serve both.
- **Compose reads its `.env` at parse time**, before any container starts. NestJS reads its `.env` at application startup. Different lifecycles.
- **`VITE_` prefixed variables are baked into the frontend build**, not read at runtime. Different mechanics entirely.
- **`.dockerignore` excludes `backend/.env`** from the image, so the containerized backend can't read it even if we wanted it to.

The three-file pattern is the idiomatic solution for projects that support both Docker and host-based development. It's verbose but explicit — every tool reads the file it expects, and there's no ambiguity about which variables apply where.

---

### Security Note

All three files are **gitignored**. Only the `.env.example` templates are committed.

**Verify before pushing:**

```bash
# Should return nothing (no tracked .env files)
git ls-files | grep -E "^\.env$|/\.env$"

# Should list the .example files (templates ARE tracked)
git ls-files | grep "\.env\.example"
```

If a real `.env` ever gets committed accidentally:

```bash
git rm --cached path/to/.env
git commit -m "chore: remove accidentally committed .env"
# Rotate any secrets that were exposed
```

The JWT secrets in this project are placeholders (`change-me-access`, `change-me-refresh`). For production, replace them with long random strings:

```bash
openssl rand -base64 48
```

---

### Quick Reference Card

| Question                                            | Answer                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Docker is broken — which file do I check?           | root `.env`                                                          |
| NestJS can't connect to the DB in dev — which file? | `backend/.env`                                                       |
| Frontend can't reach the API — which file?          | Neither. Check `vite.config.ts` (dev) or `nginx.conf` (Docker)       |
| I want real LLM for manual testing — which file?    | `cp backend/.env.openai-backup backend/.env`                         |
| I want offline tests to run fast — which file?      | `cp backend/.env.mock-backup backend/.env`                           |
| I want to change the DB password — which files?     | Root `.env` AND `backend/.env`                                       |
| I forgot which env var I set — where do I look?     | Check all three; the tables above tell you which tool owns which var |

---

### Summary

Three `.env` files, three responsibilities:

- **Root `.env`** → Compose interpolation for Docker mode
- **`backend/.env`** → Backend host development (fast iteration loop)
- **`frontend/.env`** → Frontend host development (Vite build-time vars)

They don't conflict. They aren't redundant. Each is read by exactly one tool in exactly one context. Keeping all three is the standard pattern for projects that support both local development and containerized deployment.

---

## Verification and Testing

### Test suite

```bash
cd backend
npx vitest run
```

54 tests across 7 files:

- `decision.engine.spec.ts` — 20 cases (boundaries, precedence, wrinkles)
- `chunking.spec.ts` — 8 cases
- `mock.provider.spec.ts` — 8 cases
- `mock-embedding.provider.spec.ts` — 5 cases
- `ticket.service.spec.ts` — 6 cases
- `approvals.service.spec.ts` — 6 cases
- `refunds` — 1 case

All tests use mock providers — no Ollama, no OpenAI, no network.

### Manual verification

See the workflow in [Running Locally](#running-locally). For real-LLM verification, submit a ticket with the openai provider active and check that the audit trace shows `"provider": "openai"` on the `AI_CLASSIFICATION` event.

### Database inspection

```bash
# Interactive DB shell
docker exec -it ai-support-postgres psql -U ai_support -d ai_support

# Prisma Studio
cd backend && npx prisma studio
```

---

## Real LLM vs Mock Providers

The project ships with **mock providers as the default**. This is deliberate:

| Concern           | Mock             | Real (Ollama)           |
| ----------------- | ---------------- | ----------------------- |
| Test speed        | <1s per workflow | 15–60s per workflow     |
| Determinism       | 100%             | Variable                |
| External services | None             | Ollama + 4.7 GB model   |
| CI-friendliness   | Perfect          | Requires setup          |
| Portfolio demo    | Runs anywhere    | Requires model download |

**The mock isn't a stub.** It's a genuine reference implementation:

- `MockProvider.classifyTicket()` uses deterministic rules that correctly classify every seeded scenario.
- `MockEmbeddingProvider.embed()` uses token-hash bag-of-words — semantically related text gets meaningful positive cosine similarity.

The interfaces (`AIProvider`, `EmbeddingProvider`) are the same for both. Switching is one env var.

**Real-LLM verification is a manual step.** Every code change is verified first against the mock (fast, deterministic) and then optionally against Ollama (real, slow, but proves production behavior).

---

## Key Design Principles

These principles drove every architectural decision in the project.

### 1. AI reasons; code decides

The LLM classifies intent. Code decides whether a refund is allowed. Never the reverse.

```text
LLM:     "This looks like a refund request."
Backend: "Let me verify the order."
Rules:   "Order is 45 days old — outside the 30-day window."
Result:  REJECT_REFUND
```

An LLM should never have direct authority over a financial action. It should only ever produce structured inputs to a deterministic decision process.

### 2. Validate at the boundary, not the consumer

LLM output is parsed through a zod schema the moment it arrives. If it doesn't conform, the request fails loudly rather than propagating corrupted data.

Same pattern for embeddings: `EmbeddingProvider` declares `dimensions`, and callers verify.

### 3. Keep DB transactions short

**Never hold a transaction open across an external API call.**

This was learned the hard way. The first version of `TicketService` wrapped the entire workflow — including LLM calls — in one `$transaction`. With mock providers that finished in <1s. With real Ollama, cold start took 27s and Prisma killed the transaction at the 5-second mark with `P2028`.

The fix was restructuring into five phases:

- Phase 1 (short tx): create ticket
- Phase 2 (no tx): classify, RAG, order lookup, decision
- Phase 3 (short tx): side effects
- Phase 4 (no tx): response generation
- Phase 5 (short tx): final writes

Each transaction is now sub-second. External latency lives outside any DB lock.

### 4. Idempotency by natural key

- **RAG ingestion** — idempotent by `filename`. Re-ingesting a policy replaces it.
- **Refunds** — `Refund.ticketId` is `@unique`. Same ticket can't refund twice.
- **Refund wrinkles** — decision engine rejects when order status is `REFUNDED`.

A workflow that can't be safely retried isn't a workflow.

### 5. Audit is not logging

Every state change writes a structured `AuditLog` row with an `actor`, `event`, and `metadata` JSON. The audit log **is the execution trace** — it's what powers `GET /tickets/:id` for debugging and what the future React dashboard will visualize.

Audit writes participate in the same transaction as the change they record. If the change rolls back, so does the audit entry.

### 6. Deterministic tests over AI tests

The decision engine has 20 test cases. None of them touch an LLM. Every branch, every boundary, every precedence rule is verified.

The AI layer has separate tests for its mock provider. Real-LLM behavior is verified manually, not in CI.

This split is deliberate: the parts that must be correct (business logic) are tested exhaustively. The parts that are inherently non-deterministic (LLM output) are validated structurally, not semantically.

---

# Part 6 — Technical Deep Dive

This section explains the _why_ behind every technical choice in the system. If you're interviewing for an AI automation role, these are the questions you'll be asked — and the answers should come from deep understanding, not memorization.

## 1. Why RAG and Not Fine-Tuning?

**The question:** Why retrieve policy documents at query time instead of fine-tuning the LLM on your policies?

**The answer:** Three reasons.

### 1.1 Policies change frequently

Fine-tuning bakes knowledge into model weights. When a policy changes (refund window from 30 to 14 days), you must re-fine-tune the model — expensive, slow, and requires labeled data.

RAG retrieves documents at query time. When a policy changes, you update one markdown file, re-ingest it, and the next query uses the new policy. **Zero retraining.**

### 1.2 Auditability

With RAG, the audit log records exactly which policy chunks were retrieved:

```json
{
  "event": "RAG_RETRIEVED",
  "metadata": {
    "chunkCount": 1,
    "topScore": 0.38,
    "filenames": ["refund-policy.md"]
  }
}
```

A reviewer can see _which_ policy informed _which_ decision. With fine-tuning, you can't trace which training example influenced which output.

### 1.3 Cost

Fine-tuning a 7B parameter model costs $100–$1000+ per run, depending on hardware. Re-embedding a policy document costs effectively nothing (a single embedding call).

**When fine-tuning would be better:** if you needed the model to learn a _style_ or _format_ of response, not factual knowledge. For policy Q&A, RAG wins decisively.

---

## 2. Embedding Model Selection — Why nomic-embed-text?

**The question:** Why did you pick nomic-embed-text over OpenAI's `text-embedding-3-small` or a domain-specific model?

**The answer:** Three constraints drove the choice.

### 2.1 Local-first

The project's constraint was: **everything runs on a laptop, no external API calls in dev mode.**

nomic-embed-text runs entirely locally via Ollama. OpenAI's embedding model requires an API key and sends data to OpenAI's servers.

For a portfolio project demonstrating _local_ AI automation, this matters. It's also a real production consideration — some companies legally cannot send data to third-party AI services (healthcare, finance, defense).

### 2.2 Quality for the use case

nomic-embed-text is a **768-dimensional** model trained on a large corpus including technical and general text. For retrieving policy documents (short, structured, English), it performs comparably to OpenAI's models.

Benchmarks (MTEB retrieval) put nomic-embed-text slightly below text-embedding-3-small on some tasks, but the gap is small enough that locality wins for this use case.

### 2.3 Cost and rate limits

OpenAI's embedding API costs ~$0.02 per million tokens. For a portfolio project, that's negligible. But it also enforces rate limits — at scale, this becomes a bottleneck.

Local embeddings have no rate limit. You can embed 10,000 documents in a few minutes without throttling.

### 2.4 Model versioning risk

OpenAI occasionally deprecates embedding models (`text-embedding-ada-002` was deprecated with ~6 months notice). When they do, all stored embeddings become incompatible — you must re-embed everything.

Local models don't have this problem. You control the version indefinitely.

**Trade-off accepted:** 768 dimensions is smaller than OpenAI's 1536. Smaller vectors = less expressive but faster and cheaper. For policy retrieval, 768 is plenty.

### 2.5 The dimension gotcha

`nomic-embed-text` outputs **768-dimensional** vectors. OpenAI's `text-embedding-3-small` outputs **1536**. The original project spec said "1536" (matching OpenAI), but we chose nomic and had to reconcile the schema:

```prisma
embedding Unsupported("vector(768)")
```

**Lesson:** the embedding dimension is a _schema contract_. Changing the model means migrating the column.

---

## 3. Similarity Metric — Why Cosine and Not Dot Product or Euclidean?

**The question:** pgvector supports `<->` (L2 distance), `<#>` (inner product), and `<=>` (cosine distance). Why cosine?

**The answer:** Each metric has different semantics, and cosine is the right one for text embeddings.

### 3.1 What each metric measures

| Operator | Metric          | Measures                                      |
| -------- | --------------- | --------------------------------------------- |
| `<->`    | Euclidean (L2)  | Absolute distance between points              |
| `<#>`    | Inner product   | Alignment weighted by magnitude               |
| `<=>`    | Cosine distance | Angle between vectors (magnitude-independent) |

### 3.2 Why cosine for text

Text embeddings encode **semantic direction**, not magnitude. A short sentence and a long paragraph about the same topic produce vectors pointing in similar directions, but with different magnitudes.

Cosine similarity ignores magnitude and measures only direction:

```
similarity = (A · B) / (||A|| × ||B||)
```

This means:

- `"refund"` and `"I want a refund for my damaged order"` → high similarity
- `"refund"` and `"shipping"` → low similarity

If we used Euclidean distance, the magnitude difference would dominate, and unrelated vectors with similar magnitudes would appear "close."

### 3.3 Normalized embeddings

Both nomic-embed-text and our mock provider produce **normalized** vectors (unit length). For normalized vectors:

```
cosine_similarity = dot_product
```

So with normalized embeddings, cosine and inner product give the same result. We use `<=>` (cosine) because it's the semantically correct choice and doesn't depend on the embeddings being normalized.

### 3.4 The formula in our code

```sql
1 - (embedding <=> $1::vector) AS score
```

`<=>` returns cosine **distance** (0 to 2, where 0 means identical). We compute `1 - distance` to get **similarity** (where 1 means identical, 0 means orthogonal).

- Score 1.0 → identical
- Score 0.7 → very related
- Score 0.3 → somewhat related
- Score 0.0 → orthogonal (unrelated)
- Score < 0 → anti-correlated (rare)

---

## 4. Chunking Strategy — Why Headings + Overlap?

**The question:** How did you chunk policy documents? Why that approach?

**The answer:** The chunking strategy balances three concerns:

### 4.1 The three concerns

1. **Semantic coherence** — each chunk should be about one topic
2. **Retrieval precision** — smaller chunks retrieve more focused matches
3. **Context sufficiency** — larger chunks give the LLM more to reason over

These are in tension. Chunks that are too small lose context; chunks that are too large dilute relevance.

### 4.2 The chosen strategy

```typescript
function chunkMarkdown(
  markdown: string,
  maxChars = 800,
  overlapChars = 100,
): Chunk[];
```

**Algorithm:**

1. Split on markdown headings (`#`, `##`, `###`)
2. If a section is under 800 chars, keep it whole
3. If a section is over 800 chars, split on character windows with 100-char overlap

**Why headings:** policy documents are already organized semantically. `# Refund Policy` covers refunds; `## Damaged Orders` covers damaged orders. Headings are free semantic markers.

**Why 800 chars:** empirically, this is roughly one paragraph — enough for context, small enough for focused retrieval. Most policy sections fit whole.

**Why 100-char overlap:** without overlap, a sentence that spans the boundary between chunks is split awkwardly. With overlap, the boundary content appears in both chunks, ensuring the retriever catches it.

### 4.3 What we didn't do (and why)

**Semantic chunking** (using embeddings to find natural breakpoints) — expensive, adds a second embedding call per document, and doesn't meaningfully improve retrieval for structured markdown.

**Fixed-token chunking** (500 tokens per chunk) — requires tokenization, produces arbitrary boundaries mid-sentence, and doesn't respect semantic structure.

**Recursive chunking** (splitting on paragraphs, then sentences, then words) — more complex, marginal benefit for policy docs. Worth revisiting for unstructured content.

### 4.4 The trade-off accepted

A chunk like "Customers may request a refund within 30 days" gets embedded as one unit. That's fine — it's a complete thought.

But a policy that says "Orders above $500 require human approval" split across two chunks would lose meaning. The heading-split prevents this: policies usually have complete statements per heading.

**If retrieval quality degrades:** increase `maxChars` or improve the chunker to split on paragraph boundaries. The current strategy is a starting point.

---

## 5. Structured Output — Why zod and Not Just Prompting?

**The question:** Why validate LLM output with a schema? Why not just prompt carefully and trust the output?

**The answer:** Because "prompting carefully" fails approximately 5–15% of the time with production LLMs, and those failures are silent.

### 5.1 The failure modes we're preventing

Without validation, a hallucinating LLM can return:

```json
{ "intent": "maybe refund", "confidence": "very high" }
```

Or:

```json
{ "intent": "refund", "orderId": 123, "confidence": 1.5 }
```

Or:

```json
I think the customer wants a refund. Here's my analysis...
```

These all break downstream code in different ways:

- `"maybe refund"` doesn't match any valid intent → decision engine throws or silently defaults
- `confidence: 1.5` violates the range constraint → downstream math is wrong
- Free text can't be parsed at all → 500 error

### 5.2 How zod prevents this

```typescript
export const TicketClassificationSchema = z.object({
  intent: z.enum([...]),
  orderId: z.string().nullable(),
  priority: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
});
```

If the LLM returns anything that doesn't match:

- The `safeParse()` returns `success: false`
- The provider throws with the exact validation error
- The ticket fails cleanly with an auditable reason

**Silent garbage never propagates.**

### 5.3 Why zod specifically (not JSON Schema, not class-validator)

| Tool            | Why not                                                             |
| --------------- | ------------------------------------------------------------------- |
| JSON Schema     | Schema is data, not code. No TypeScript type inference.             |
| class-validator | Designed for HTTP DTOs, not arbitrary external data. Needs a class. |
| Yup             | Older, less TypeScript-native, heavier                              |
| zod             | TypeScript-first, infers types from schema, tiny, excellent DX      |

With zod, the schema is also the TypeScript type:

```typescript
export type TicketClassification = z.infer<typeof TicketClassificationSchema>;
```

One source of truth. Change the schema, the type updates.

### 5.4 The `response_format` belt-and-braces

The provider additionally uses Ollama's `response_format: { type: "json_object" }` to encourage valid JSON output. This reduces but does not eliminate failures. The zod validation is the actual guarantee.

**Interview-ready phrasing:** "We use prompt-level JSON instructions, model-level `response_format`, and schema-level zod validation. Only the third is a hard guarantee — the first two reduce frequency, not eliminate risk."

---

## 6. Temperature — Why 0 for Classification and 0.2 for Response?

**The question:** Why different temperatures for different LLM calls?

**The answer:** Because classification and generation have different requirements.

### 6.1 Temperature controls randomness

| Temperature | Effect                                             |
| ----------- | -------------------------------------------------- |
| 0           | Deterministic — always picks the most likely token |
| 0.2         | Nearly deterministic, slight variation             |
| 0.7         | Balanced                                           |
| 1.0+        | Creative, less coherent                            |

### 6.2 Classification needs determinism

Classification is a **fact extraction** task. Given "My order #124 arrived damaged," the intent should always be `damaged_order`. Temperature 0 ensures:

- Same input → same output (reproducible)
- No hallucinated intents from "creative" sampling
- Confidence scores are stable

We could use `-1` (some providers support it) but 0 is the standard minimum.

### 6.3 Response generation benefits from slight variation

Response generation is a **language** task. The customer response should sound natural, not robotic.

Temperature 0.2 gives:

- Consistency (still deterministic-ish)
- Slight variation in phrasing (natural-sounding)

Temperature 0 would produce the same exact response every time for the same decision — feels canned.

### 6.4 The trade-off

We could use temperature 0 for response generation too. But:

- Customers notice repetitive responses
- Slight variation feels more human
- The classification gate has already ensured correctness

**Rule of thumb:**

- **Extraction tasks** → temperature 0
- **Generation tasks** → temperature 0.2–0.7
- **Creative tasks** → temperature 0.8–1.0

---

## 7. Mock Providers — Why Not Just Stub Them?

**The question:** Why did you build a functional mock AI provider instead of a simple stub that returns fixed values?

**The answer:** Because a good mock is a reference implementation, not a placeholder.

### 7.1 What a bad mock looks like

```typescript
async classifyTicket(message: string) {
  return { intent: 'refund', orderId: null, priority: 'medium', confidence: 0.9 };
}
```

This always returns the same thing, regardless of input. Tests pass, but:

- You can't test scenario coverage (auto-refund vs approval vs reject)
- The RAG scores are meaningless (all zero)
- E2E tests can't verify different decision paths

### 7.2 What our mock actually does

```typescript
// MockProvider.classifyTicket
if (lower.includes("damaged")) intent = "damaged_order";
if (lower.includes("refund")) intent = "refund";
if (lower.includes("where") && lower.includes("order")) intent = "order_status";
// ...
```

It **actually classifies** based on message content. Every seeded scenario produces the correct intent. E2E tests can verify all decision paths.

### 7.3 The embedding mock — the interesting case

The original mock used pseudo-random vectors. This produced **negative cosine similarity** for semantically related text, because random vectors are orthogonal.

The fix: **token-hash bag-of-words**.

```typescript
private hashToVector(text: string): number[] {
  const v = new Array(this.dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    v[c % this.dimensions] += 1;
    v[(c * 31) % this.dimensions] += 0.5;
  }
  // normalize to unit length
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / mag);
}
```

**Why this works:** text with shared vocabulary produces vectors with overlapping non-zero positions → positive cosine similarity. Text with no shared vocabulary → orthogonal vectors → zero similarity.

This gives RAG tests meaningful relative rankings:

- Query "damaged order" → higher score against "damaged-orders.md" than "shipping-policy.md"

### 7.4 Why this matters for interviews

Most candidates say "I mocked the LLM." Strong candidates explain **how** and **why**:

> "The mock isn't a stub. It's a deterministic reference implementation. The mock classifier reproduces the semantic behavior of a real LLM on our test scenarios, and the mock embedding provider uses token-hash bag-of-words so RAG search produces meaningful positive scores without a real model. This means our 60 tests run offline, in CI, deterministically, while still exercising the same code paths as production."

That answer demonstrates understanding of what mocks should accomplish.

---

## 8. Structured Output vs Tool Calling — Why Not Function Calling?

**The question:** Modern LLMs support function calling / tool use. Why not use that instead of structured JSON output?

**The answer:** Because function calling is the right tool for a _different problem_, and we haven't needed it yet.

### 8.1 What function calling does

Tool/function calling lets the LLM **decide to invoke a function** with arguments:

```json
{
  "name": "get_order",
  "arguments": { "orderId": "124" }
}
```

The application executes the function and returns the result to the LLM, which continues the conversation.

### 8.2 What our system does instead

Our workflow is a **fixed pipeline**, not an agentic loop:

```
classify → RAG → lookup → decide → act → respond
```

Each step is deterministic. The LLM only participates in `classify` and `respond`. It doesn't choose which tool to call — the code decides.

### 8.3 Why this is intentional

For financial actions (refunds), you **don't want** the LLM deciding which tool to call. You want deterministic code executing fixed steps.

An agentic LLM could:

- Forget to check if the order exists before refunding
- Call `create_refund` twice
- Skip the decision engine entirely

Our design prevents this by making the pipeline the code's responsibility, not the LLM's.

### 8.4 When we _would_ use tool calling

For **multi-turn conversations** where the customer's request isn't clear upfront:

> Customer: "I have a problem with an order."
> LLM: calls `get_recent_orders(customerId)` → 3 orders
> LLM: calls `get_order_status(orderId)` for each → finds a delayed one
> LLM: asks "Is this the order you mean?"

This is a Phase 11+ feature. The current system handles single-shot requests, which covers 80%+ of support tickets.

### 8.5 The interview-ready answer

> "We deliberately avoid function calling for the decision pipeline. The LLM classifies intent; code executes the pipeline deterministically. Function calling would be appropriate for a multi-turn agentic flow where the LLM needs to gather information across turns — that's a future extension. For single-shot ticket automation, structured output plus a fixed pipeline is safer."

---

## 9. Confidence Thresholds — Why 0.85?

**The question:** Why is the confidence threshold 0.85? Where did that number come from?

**The answer:** It's a tunable starting point, not a magic number.

### 9.1 What the threshold does

```typescript
if (confidence < policy.confidenceThreshold) {
  return { action: 'NEEDS_HUMAN_REVIEW', ... };
}
```

Low-confidence classifications route to humans instead of being auto-handled.

### 9.2 How to choose the right value

The threshold controls a trade-off:

| Threshold       | Effect                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Too low (0.5)   | Automates uncertain cases → more wrong decisions → customer complaints |
| Too high (0.99) | Everything routes to humans → no automation value                      |
| Balanced (0.85) | Common starting point for classification tasks                         |

### 9.3 The starting heuristic

Empirically:

- **High confidence** (>0.9) — the LLM "knows" the intent
- **Medium confidence** (0.7–0.9) — the LLM is reasonably sure but there's ambiguity
- **Low confidence** (<0.7) — the LLM is guessing

  0.85 routes the bottom 15–25% to humans. That's usually a good balance for support automation.

### 9.4 How to tune it

In production:

1. Log classification + confidence + decision + outcome for every ticket
2. Manually review a sample of auto-handled tickets
3. If you find many errors, raise the threshold
4. If you find many correct cases routed to humans, lower it

**The threshold should be based on observed data, not a guess.** We chose 0.85 as a starting point because:

- It's above the "ambiguous" range
- It's below the "fully certain" range (which the LLM rarely reaches on natural language)
- It's configurable via `CONFIDENCE_THRESHOLD` env var

### 9.5 The interview-ready framing

> "0.85 is a starting heuristic. In production you'd tune it based on observed error rates in auto-handled tickets. The important architectural choice is that the threshold is _externalized_ — it's an env var, not a hardcoded constant. That makes it tunable without code changes."

---

## 10. Why Idempotency Matters — And How It's Enforced

**The question:** What does "idempotent" mean in this system, and why does it matter?

**The answer:** It means the same request twice produces the same effect, not a duplicated effect.

### 10.1 The problem

Consider a refund workflow:

1. Customer requests refund
2. Backend creates refund
3. Network fails before response reaches customer
4. Customer retries → backend creates **another refund**

Two refunds for one order. The business loses money.

### 10.2 The solution — idempotency by natural key

**Refunds:** `Refund.ticketId` has a `@unique` constraint.

```typescript
async createForTicket(ticketId, orderId, amount, reason, db) {
  const existing = await db.refund.findUnique({ where: { ticketId } });
  if (existing) return existing;
  return db.refund.create({ data: { /* ... */ } });
}
```

Same ticket → same refund. Retries return the existing one.

**Approvals:** `ApprovalRequest.ticketId` is `@unique`. Same principle.

**RAG ingestion:** idempotent by `filename`. Re-ingesting a document replaces it (cascade delete of chunks, then create).

**Order wrinkles:** the decision engine rejects refunds when the order is already `REFUNDED` or has a `COMPLETED` refund. This is a _semantic_ idempotency check — the system won't even attempt a duplicate.

### 10.3 Why the unique constraint matters

Application-level checks aren't enough. Race conditions can slip through:

```
Request A: check existing → not found
Request B: check existing → not found
Request A: create refund
Request B: create refund (duplicate!)
```

A **database-level unique constraint** ensures only one wins. The other fails with a Prisma error (P2002), which the caller can catch and handle gracefully.

**Belt and braces:** application check + database constraint.

### 10.4 Interview-ready framing

> "Idempotency isn't optional for financial actions. We enforce it at two layers: an application-level `findUnique` check for the common case, and a database unique constraint for the race condition. The unique constraint is the actual guarantee — the application check just produces a nicer response."

---

## 11. Why Short Transactions — And the Bug That Forced the Refactor

**The question:** Why is the ticket workflow split into five phases instead of one transaction?

**The answer:** Because **external API calls must never hold a database transaction open.**

### 11.1 The original design

Phase 7's first implementation wrapped everything in a single transaction:

```typescript
return this.prisma.$transaction(async (tx) => {
  const ticket = await tx.ticket.create({
    /* ... */
  });
  const classification = await this.ai.classifyTicket(message); // LLM call!
  const chunks = await this.rag.searchKnowledge(message); // LLM call!
  const decision = this.decision.evaluate(/* ... */);
  const refund = await tx.refund.create({
    /* ... */
  });
  const response = await this.ai.generateCustomerResponse(/* ... */); // LLM call!
  // ...
});
```

### 11.2 Why this failed

Prisma's default interactive transaction timeout is **5 seconds**. With mock providers, the whole workflow completed in <1 second. With real Ollama:

```
[Nest] 30096 - ERROR [TicketService] Ticket processing failed
PrismaClientKnownRequestError:
Transaction API error: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 27349 ms passed
since the start of the transaction.
```

The LLM cold-start took 27 seconds. The transaction expired at 5 seconds. Every real-LLM request failed.

### 11.3 The lessons

**Lesson 1: Mock providers hide latency concerns.**

The mock runs in milliseconds. The real LLM runs in seconds. A design that works with mocks can fail catastrophically with real providers.

**Lesson 2: External calls don't belong in transactions.**

Even without timeouts, holding a transaction during an LLM call:

- Locks database rows for 30+ seconds
- Blocks concurrent writers
- Wastes connection pool slots
- If the LLM hangs, orphaned transactions accumulate

**Lesson 3: The correct pattern is phase-split.**

- Short transactions for writes
- No transaction for external calls
- Idempotency handles the "what if a later phase fails" case

### 11.4 The restructured design

| Phase                                | Transaction? | Duration | External calls  |
| ------------------------------------ | :----------: | -------- | --------------- |
| 1 — create ticket                    |   ✅ short   | ~10ms    | none            |
| 2 — classify + RAG + lookup + decide |      ❌      | variable | LLM, embeddings |
| 3 — side effects                     |   ✅ short   | ~30ms    | none            |
| 4 — generate response                |      ❌      | variable | LLM             |
| 5 — final writes                     |   ✅ short   | ~10ms    | none            |

### 11.5 The new trade-off

If Phase 4 or 5 fails after Phase 3 commits, the ticket is `FAILED` but the refund is committed. This is the cost of not holding a transaction across an LLM call.

**Why it's acceptable:**

- Phase 4/5 failures are rare (they don't call external services)
- The audit log records the exact failure
- A retry endpoint (`POST /tickets/:id/retry`) recovers the workflow idempotently
- The alternative (all-or-nothing transaction) _doesn't work_ with real LLM latency

### 11.6 Interview-ready framing

> "The original design held a transaction across the LLM call. It worked with mocks but broke with real Ollama — the transaction timed out at 5 seconds while the LLM was still loading. The fix was phase-splitting: short transactions for writes, no transaction for LLM calls. This is the correct pattern for any workflow that involves external latency. The trade-off is a small chance of partial commit, which we handle with a retry endpoint."

---

## 12. Why Audit Trails Are Structured — Not Just Logs

**The question:** Why is the audit trail a database table instead of just log lines?

**The answer:** Because structured audit metadata is _queryable_, and audit data is _semantically important_.

### 12.1 Structured vs unstructured

**Unstructured (log line):**

```
[2026-09-11 11:58:43] Ticket cmtwwkgvz classified as damaged_order with confidence 0.9
```

**Structured (database row):**

```json
{
  "ticketId": "cmtwwkgvz",
  "event": "AI_CLASSIFICATION",
  "actor": "AI",
  "metadata": {
    "intent": "damaged_order",
    "orderId": "124",
    "priority": "high",
    "confidence": 0.9,
    "provider": "openai"
  },
  "createdAt": "2026-09-11T11:58:43.734Z"
}
```

### 12.2 What structured audit enables

**Queryable analytics:**

```sql
SELECT AVG((metadata->>'confidence')::float)
FROM "AuditLog"
WHERE event = 'AI_CLASSIFICATION';
```

**Compliance reconstruction:** Every decision's inputs are recorded. Regulators can ask "why was this refund issued?" and get a precise answer.

**Debugging:** When something goes wrong, the exact sequence of events is preserved.

**Visualization:** The React dashboard renders the trace as a timeline, showing actors and timestamps.

### 12.3 Why transactions matter here

Audit writes participate in the same transaction as the change they record:

```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.refund.create({
    /* ... */
  });
  await this.audit.record(
    ticket.id,
    "REFUND_CREATED",
    "system",
    {
      /* ... */
    },
    tx,
  );
});
```

**Why:** If the refund rolls back, so does the audit. No false positives in the log.

### 12.4 The actor taxonomy

Every audit event has an actor:

| Actor    | Meaning                                             |
| -------- | --------------------------------------------------- |
| `HUMAN`  | Customer (submitting a ticket)                      |
| `AI`     | LLM inference (classification, response generation) |
| `SYSTEM` | Code (order lookup, decision, refund creation)      |
| `AGENT`  | Human agent (approval, rejection)                   |

This distinction matters for compliance: "how many decisions were made by AI vs humans?" is answerable from the audit log alone.

### 12.5 Interview-ready framing

> "The audit trail isn't logging — it's a structured, queryable record. Every event has an actor, a type, and JSON metadata. Audit writes participate in the same transaction as the change they record, so there are no false positives. This makes the system compliant with audit requirements and gives us the data to answer 'why did the AI do that?'"

---

## 13. Provider Abstraction — Why Both AIProvider and EmbeddingProvider?

**The question:** Why do you have two separate provider abstractions instead of one?

**The answer:** Because the two concerns have different interfaces, different constraints, and different swap-out scenarios.

### 13.1 The interfaces

```typescript
interface AIProvider {
  classifyTicket(message: string): Promise<TicketClassification>;
  generateCustomerResponse(context: ResponseContext): Promise<string>;
}

interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
```

### 13.2 Why they can't be merged

**Different shapes:** AI returns structured JSON, embeddings return numeric vectors.

**Different dimensions:** Classification outputs ~4 fields, embeddings output 768 numbers.

**Different swap-out scenarios:** You might change the chat model (qwen2.5:7b → llama3.1:8b) without changing the embedding model, or vice versa. Merging them forces a coordinated change.

**Different batch semantics:** `embedBatch()` is used during ingestion (embed 50 chunks at once). Classification is always one message at a time.

### 13.3 The pattern — dependency inversion

Both interfaces follow the same pattern:

```
Service → Interface → Concrete provider
```

The service knows only the interface. The provider is selected by a factory:

```typescript
const providerFactory = {
  provide: AI_PROVIDER,
  useFactory: () => {
    const mode = process.env.AI_PROVIDER ?? "mock";
    return mode === "mock"
      ? new MockProvider()
      : new OpenAICompatibleProvider();
  },
};
```

**Interview-ready framing:**

> "We have two provider abstractions because they solve two different problems. The AI provider handles classification and generation — structured text in, structured text out. The embedding provider handles vector generation — text in, numeric vector out. They share the same dependency-inversion pattern but have different interfaces because their contracts are fundamentally different."

---

## 14. Security Decisions — Why JWT, Why Roles, Why Rate Limiting?

**The question:** Walk me through the auth and security model.

**The answer:** Three layers, each addressing a distinct threat.

### 14.1 JWT for stateless auth

**Why JWT:** Stateless. Every request carries its own proof of identity. No session store, no sticky sessions, no shared session state across replicas.

**The trade-off:** JWTs can't be revoked before expiry. Our `JWT_ACCESS_TTL` is 15 minutes, so a compromised token has a 15-minute window. Refresh tokens (7-day TTL) can be revoked server-side (in a future extension).

**Why not sessions:** For a distributed deployment, sessions require a shared session store (Redis, database). JWT avoids this entirely.

### 14.2 Role-based access control (RBAC)

Three roles: `CUSTOMER`, `AGENT`, `ADMIN`.

**Why three:** Each has a distinct authority level.

| Role     | Can do                            | Cannot do                              |
| -------- | --------------------------------- | -------------------------------------- |
| CUSTOMER | Submit tickets                    | Approve refunds, view others' data     |
| AGENT    | Approve refunds, view all tickets | Seed test data, retry failed workflows |
| ADMIN    | Everything                        | Nothing (highest authority)            |

**Enforcement:** `@Roles(Role.AGENT, Role.ADMIN)` on sensitive endpoints.

**Principle of least privilege:** Customers can't see agent endpoints. Agents can't reach admin tools.

### 14.3 Rate limiting for abuse prevention

**Why:** Public endpoints are attack surfaces. `POST /auth/login` is the classic credential-stuffing target.

**The tiers:**

- Login: 10/min (strictest — credential stuffing)
- Register: 5/min (account creation abuse)
- Tickets: 20/min (spam prevention)
- Default: 60/min (baseline)
- Authenticated endpoints: no extra throttle (trusted)

**Why different limits:** The damage per request varies. A failed login attempt is more dangerous than a failed ticket submission.

### 14.4 Global guard ordering

```
ThrottlerGuard → JwtAuthGuard → RolesGuard
```

**Why this order:**

- Throttler first — reject abusive clients before expensive auth checks
- JWT before roles — role check needs `request.user`, which JWT populates
- Roles last — cheapest check runs after the expensive ones

### 14.5 The `@Public()` opt-out

Most endpoints require auth by default. `@Public()` explicitly opts out for customer-facing endpoints (`POST /tickets`, `/auth/login`, `/auth/register`).

**Why default-deny:** Secure by default. Adding a new endpoint without thinking about auth means it's protected. You must consciously mark it public.

**The gotcha:** Never combine `@Public()` with `@Roles()`. `@Public()` skips JWT auth, but `RolesGuard` still runs and finds no user → 403. We avoid this by never stacking them.

### 14.6 Interview-ready framing

> "Security has three layers: JWT for stateless identity, RBAC for authorization, and rate limiting for abuse prevention. Guards run in a specific order — throttle first, then auth, then roles — because the cheaper checks should reject requests before expensive ones run. Endpoints default to requiring auth; `@Public()` is the explicit opt-out for customer-facing routes. We never mix `@Public()` and `@Roles()` on the same route."

---

## 15. Observability — What Would You Add for Production?

**The question:** What observability is missing from this system?

**The answer:** Several things a production deployment would need.

### 15.1 What we have

- **Audit trail** — every state change recorded
- **Analytics endpoint** — aggregate metrics
- **Structured logs** — NestJS logger with trace IDs
- **Health checks** — Docker healthcheck on Postgres

### 15.2 What's missing

**Distributed tracing** — OpenTelemetry spans across the workflow. Right now the audit log shows events but not timing relationships between services.

**Metrics export** — Prometheus or StatsD. The analytics endpoint requires a request; a metrics export would push to a scraping system.

**Alerting** — when the failure rate spikes, when automation rate drops, when average confidence declines.

**Error tracking** — Sentry or Rollbar. Currently errors go to logs only.

**LLM-specific metrics** — tokens consumed, cost per ticket, latency percentiles.

**Cost tracking** — for OpenAI-compatible providers, cost per classification.

### 15.3 What to add first in production

1. **Structured JSON logs** with correlation IDs — replace NestJS pretty logs with JSON in production
2. **Prometheus metrics** — expose `/metrics` with counts, rates, histograms
3. **Alerting on** — failed ticket rate, average confidence trend, LLM error rate
4. **Cost tracking** — token count per LLM call, aggregated daily

### 15.4 Interview-ready framing

> "The system has an audit trail as its primary observability layer. For production, I'd add OpenTelemetry for distributed tracing, Prometheus for metrics export, and alerting on failure rate and confidence trends. The audit log already gives us per-ticket granularity; what's missing is aggregate real-time visibility."

---

## 16. Testing Strategy — Why Unit + E2E, Why Mock Providers?

**The question:** Walk me through your testing strategy.

**The answer:** Two layers with distinct purposes, plus a manual real-LLM verification pass.

### 16.1 Unit tests (54 tests, mock providers)

**Coverage:**

- Decision engine: 20 tests (all branches, all boundaries)
- Chunking: 8 tests
- Mock providers: 13 tests
- Ticket workflow: 6 tests
- Approvals: 6 tests
- Refunds: 1 test

**Why unit tests for the decision engine:** It's pure logic. Every branch must be verified. Boundaries ($500.00 vs $500.01; 30 vs 31 days) catch regressions that would be catastrophic in production.

**Why unit tests for mocks:** The mock provider's behavior is a contract. If someone changes it, tests catch the deviation.

**Why unit tests don't touch the real LLM:** Determinism, speed, no external dependencies. The test suite runs in <1 second.

### 16.2 E2E tests (6 tests, real DB)

**Coverage:**

- Full workflow: submit → classify → RAG → decide → act → respond
- Approvals: submit high-value → approve → refund
- Idempotency: re-refund attempt → rejection
- Multiple scenarios: auto-refund, approval, reject, not-found

**Why real DB:** Unit tests mock Prisma. E2E tests use the actual schema, actual migrations, actual transactions. They catch schema changes that break code, migration bugs, and transaction issues.

**Why mock providers in E2E:** E2E tests must be deterministic. If the LLM writes a slightly different response each run, assertions become brittle. The mock provider produces consistent output.

**The isolation pattern:** E2E tests force `AI_PROVIDER=mock` in `beforeAll`, ignoring `.env`. This means a developer with `.env` pointing at Ollama can still run E2E tests without hitting the real LLM.

### 16.3 Manual real-LLM verification

Not in CI. Done manually during development to verify the system works with real models.

**Steps:**

1. Flip providers (`cp .env.openai-backup .env`)
2. Seed a fresh order (`POST /admin/seed-test-order`)
3. Submit a ticket
4. Verify the audit trace

**Why manual:** Real LLM calls take 15–60 seconds each, require Ollama running with 4.7 GB of models, and produce non-deterministic output. Not suitable for CI.

### 16.4 The testing philosophy

> **The parts that must be correct (business rules) are tested exhaustively. The parts that are inherently non-deterministic (LLM output) are validated structurally, not semantically.**

Business logic: 20 decision engine tests, all boundaries covered.

LLM behavior: tested via mock provider with deterministic outputs. Real LLM validated manually.

### 16.5 Interview-ready framing

> "We have three testing layers. Unit tests cover the deterministic parts — decision engine, chunking, mock providers — with 54 tests including all boundary cases. E2E tests hit a real database with mock providers, verifying the full workflow against the actual schema and transactions. Real LLM behavior is verified manually with Ollama, because it's non-deterministic and slow. The key principle: exhaustive coverage for logic that must be correct, structural validation for LLM output."

---

## 17. What I'd Do Differently in Production

**The question:** If you were deploying this to production for a real customer, what would you change?

**The answer:** Several things, prioritized by impact.

### 17.1 High priority

**Store embedding model version per chunk.** Currently if you change embedding models, existing chunks become incompatible with new queries. Production should record `embeddingModel: "nomic-embed-text:latest"` per chunk and reject cross-model searches.

**Add HNSW index on embeddings.** Currently `KnowledgeChunk.embedding` has no index — retrieval does a sequential scan. At 1000+ chunks, this dominates query time. HNSW is the standard for approximate nearest neighbor search.

**Distributed tracing with OpenTelemetry.** The audit log records events, but not timing relationships across services. OpenTelemetry spans would show "total request time = X, of which Y is LLM, Z is DB."

**Alerting on failure rate and confidence trends.** If the automated ticket failure rate spikes, or average classification confidence declines, alert. Currently these are only discoverable by manually querying `/analytics`.

### 17.2 Medium priority

**Prompt versioning.** Currently the system prompt in `openai-compatible.provider.ts` is a string literal. In production, prompt changes should be versioned, tested, and rolled out gradually.

**Rate limiting per user (not just per IP).** IP-based rate limiting is weak against distributed attacks. Authenticated endpoints should rate-limit by user ID.

**Real refund provider integration.** Currently refunds are mocked. Production needs Stripe (or equivalent) with webhook handling for async confirmation.

**Customer authentication.** Currently `POST /tickets` is fully public. Production should identify customers to prevent spam and enable "my tickets" views.

**Audit log retention policies.** Audit logs grow unbounded. Production needs retention rules (e.g., 7 years for compliance, then archive).

### 17.3 Low priority (nice to have)

**Multi-tenancy.** If the platform serves multiple businesses, add a `tenantId` to every table.

**Streaming responses.** Currently the LLM generates the full response before returning. Streaming would improve perceived latency.

**Batch classification.** Currently one ticket at a time. Batch processing could amortize LLM costs.

**Query rewriting for short queries.** Our RAG investigation found that short queries produce lower similarity scores. Rewriting or expanding queries would improve retrieval.

### 17.4 The honest interview answer

> "The current system is production-ready for a single-tenant deployment with moderate volume. For a real customer, I'd prioritize: (1) embedding model versioning — this is a real correctness bug waiting to happen, (2) HNSW index for retrieval at scale, (3) OpenTelemetry for cross-service timing, (4) alerting on failure rates. The architecture is sound; what's missing is operational maturity."

---

## 18. Cheat Sheet — Key Numbers and Parameters

For quick reference during interviews or design discussions:

| Parameter                  | Value        | Where                    | Why                                   |
| -------------------------- | ------------ | ------------------------ | ------------------------------------- |
| Embedding dimensions       | 768          | `EMBEDDING_DIMS`, schema | nomic-embed-text output size          |
| Chunk size                 | 800 chars    | `chunkMarkdown`          | ~1 paragraph, focused retrieval       |
| Chunk overlap              | 100 chars    | `chunkMarkdown`          | Prevent boundary sentence splits      |
| Top-K retrieval            | 3            | `searchKnowledge`        | Balance context vs. noise             |
| Classification temperature | 0            | provider                 | Determinism for extraction            |
| Response temperature       | 0.2          | provider                 | Slight variation for natural language |
| Confidence threshold       | 0.85         | `CONFIDENCE_THRESHOLD`   | Route uncertain cases to humans       |
| Refund window              | 30 days      | `REFUND_WINDOW_DAYS`     | Policy-defined                        |
| Auto-refund threshold      | $500         | `AUTO_REFUND_THRESHOLD`  | Policy-defined                        |
| JWT access TTL             | 15 min       | `JWT_ACCESS_TTL`         | Compromise window                     |
| JWT refresh TTL            | 7 days       | `JWT_REFRESH_TTL`        | Re-login interval                     |
| Login rate limit           | 10/min       | throttler                | Credential stuffing prevention        |
| Register rate limit        | 5/min        | throttler                | Account abuse prevention              |
| Ticket rate limit          | 20/min       | throttler                | Spam prevention                       |
| Transaction timeout        | 5s (default) | Prisma                   | Sub-second per phase                  |
| LLM cold start             | 10–30s       | qwen2.5:7b               | Model load into RAM                   |
| Warm LLM call              | 2–5s         | qwen2.5:7b               | Real inference time                   |

---

## 19. Common Interview Questions — Prepared Answers

### Q: How do you prevent the LLM from making bad financial decisions?

> "The LLM never makes financial decisions. It classifies intent and generates language. A deterministic decision engine — a pure function with 20 test cases covering every boundary — decides whether a refund is allowed. The LLM's output is validated through a zod schema; if it doesn't conform, the request fails loudly before any state change."

### Q: How do you ensure consistent responses across tickets?

> "Two mechanisms. First, deterministic rules: the decision engine evaluates policy uniformly. Same input always produces the same output. Second, temperature 0 for classification, so the LLM's intent extraction is deterministic. Response generation uses temperature 0.2 for slight variation, but the underlying decision is code-determined."

### Q: What happens if the LLM is wrong?

> "It depends on which kind of wrong. If the classification is wrong but high-confidence, the decision engine acts on bad input — that's a bug we mitigate by validating the classification against the order data (does the order exist? is it in the right state?). If the classification is uncertain (low confidence), it routes to human review. If the response generation is wrong but the decision is right, the customer gets a poorly-worded message — annoying but not financially damaging."

### Q: How do you handle retries and idempotency?

> "Three layers. Application-level: before creating a refund, check if one already exists for this ticket. Database-level: unique constraint on `Refund.ticketId` prevents races. Semantic-level: the decision engine rejects refunds for orders already marked `REFUNDED`. The database constraint is the actual guarantee; the others produce cleaner errors."

### Q: How do you test an AI system?

> "Split the testing. The deterministic parts — decision rules, chunking, mock providers — get exhaustive unit tests (54 total, including all boundary cases). The full workflow gets E2E tests against a real database with mock providers, verifying schema and transactions. Real LLM behavior is verified manually, not in CI, because it's slow and non-deterministic. The mock providers aren't stubs — they're reference implementations that produce meaningful output."

### Q: What's the hardest bug you hit?

> "The transaction timeout. The first version wrapped the entire workflow in a single Prisma transaction. With mock providers it ran in under a second. With real Ollama, the LLM cold start took 27 seconds and the transaction expired at 5 seconds — every real-LLM request failed with P2028. The fix was phase-splitting: short transactions for writes, no transaction for LLM calls. The lesson: mocks hide latency concerns that only surface with real infrastructure."

### Q: Why RAG and not fine-tuning?

> "Policies change frequently; fine-tuning bakes knowledge into weights and requires retraining. RAG retrieves documents at query time — updating a policy is a file change plus re-ingestion. RAG also gives us auditability: the audit log records which policy chunks were retrieved, so we can trace which policy informed which decision. Fine-tuning wouldn't allow that."

### Q: How would you scale this?

> "Horizontal scaling of the backend is trivial — it's stateless. Postgres becomes the bottleneck; a read replica handles analytics queries. The LLM is the expensive part; I'd add a queue (Redis + BullMQ) to batch classification requests and add concurrency limits. For the embedding store, add an HNSW index for faster retrieval at scale. The audit table needs partitioning by month for query performance at high volume."

### Q: What's missing for production?

> "Embedding model versioning — currently if you change embedding models, existing chunks become incompatible with new queries, silently returning bad results. HNSW indexing on embeddings. OpenTelemetry for cross-service tracing. Alerting on failure rate and confidence trends. And customer authentication — the ticket submission endpoint is currently public, which is fine for a demo but not for production spam prevention."

---

## 20. Summary — What Makes This a Real AI Automation System

Not a chatbot. Not a tutorial. Not a wrapper. A real system because:

1. **The LLM doesn't decide financial outcomes.** Code does. The LLM classifies and generates language.
2. **Business rules are deterministic and tested.** 20 test cases, all boundaries.
3. **Risk is managed with human-in-the-loop.** High-value actions require approval.
4. **Every action is auditable.** Structured audit log with actors, events, and metadata.
5. **Idempotency is enforced at two layers.** Application check plus database constraint.
6. **The transaction design accounts for external latency.** Phase-split, no LLM inside a transaction.
7. **RAG provides company-specific knowledge.** Not general LLM knowledge.
8. **Provider abstraction enables model swapping.** One env var changes the AI.
9. **Testing separates deterministic from non-deterministic.** Exhaustive for business rules, structural for LLM.
10. **The system documents its own limitations.** Known issues, roadmap, trade-offs.

These are the characteristics of production AI automation — and the ones an interviewer will probe.

If you can explain every section above with the reasoning in your own words, you can pass an AI automation engineering interview.

---

## Known Issues and Roadmap

### Known Issues

- **RAG similarity on short queries:** With real `nomic-embed-text`, very short queries can produce near-zero or slightly negative cosine similarity scores even when the correct document is retrieved. Ranking still works; scores are hard to reason about. Phase 9 investigation item.

- **Partial-commit recovery:** If Phase 4/5 of a ticket workflow fails after Phase 3 has committed (side effects written), the ticket is marked `FAILED` but the refund/approval remains committed. This is inherent to keeping transactions short. Phase 9 will add a retry endpoint.

- **`@Public()` on ticket readback:** `GET /tickets` and `GET /tickets/:id` are currently public. Customer-submitted tickets need public `POST`, but readback should be scoped once customer auth is defined.

### Roadmap

- **Phase 9:** Hardening (rate limiting, retry endpoint, admin seed, analytics, e2e test)
- **Phase 10:** React dashboard with execution trace visualization
- **Future:** Digital product refund exclusion, multi-currency support, ticket assignment, real refund provider integration

---

## License

MIT.

## Credits

Built as a portfolio project demonstrating production-grade AI automation patterns: LLM classification + structured output + RAG + tool calling + deterministic business rules + human-in-the-loop + audit logging.

The architecture is intentionally modular: any single piece (the LLM, the embedding model, the payment provider, the vector store) can be swapped without touching the others.
