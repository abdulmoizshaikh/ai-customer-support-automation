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
- [Configuration](#configuration)
- [Verification and Testing](#verification-and-testing)
- [Real LLM vs Mock Providers](#real-llm-vs-mock-providers)
- [Key Design Principles](#key-design-principles)
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

---

## Configuration

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

MIT (or your choice).

## Credits

Built as a portfolio project demonstrating production-grade AI automation patterns: LLM classification + structured output + RAG + tool calling + deterministic business rules + human-in-the-loop + audit logging.

The architecture is intentionally modular: any single piece (the LLM, the embedding model, the payment provider, the vector store) can be swapped without touching the others.

````

---

## How to Use This README

**Save it as `ai-customer-support/README.md`** — at the project root, not in `backend/`. This is the first thing anyone sees when they open your GitHub repo.

**A few notes on what I included deliberately:**

1. **The "Why This Project Exists" section** frames the project as a portfolio piece for AI automation, not just another NestJS app. This is the section a recruiter reads first.

2. **The full workflow diagram** shows the LLM → RAG → decision → action → audit flow concretely. Reviewers can see at a glance that this isn't a chatbot.

3. **Every phase has its own section** with what was built and why. This documents the incremental approach and lets a reader understand any individual piece without reading the whole codebase.

4. **The "Key Design Principles" section is the most important.** In an interview, you can point to this and say "here's how I think about AI systems." Each principle is backed by a real decision from this project — the transaction refactor, the validation boundary, the idempotency keys.

5. **"Known Issues" is honest.** Nothing hurts credibility more than a README claiming perfection. Listing the RAG similarity issue and the partial-commit recovery path shows self-awareness.

6. **The mock vs real comparison table** explicitly says the mock isn't a stub. That reframes it from "I didn't build the real thing" to "I built the right abstraction."

## A Few Optional Additions

If you want to strengthen the README further, consider adding:

- **Screenshots or a demo GIF** — even one terminal screenshot showing the workflow executing
- **A "What I Learned" section** — personal reflections on the transaction refactor, Prisma 8 RC friction, etc.
- **A link to the demo video** — if you record one later for the portfolio

## After This Lands

Once you save the README, you have:
- ✅ A complete, working AI automation system (Phases 1–8)
- ✅ Real-LLM verification with local models
- ✅ Portfolio-grade documentation
- ✅ 54 passing tests
- ✅ Full audit trail

Then Phase 9 (hardening) is the polish pass, and Phase 10 (React dashboard) makes it demoable visually. But the core system is already complete and explainable.

Commit the README:

```bash
cd ~/Documents/Projects/ai-customer-support
git add README.md
git commit -m "docs: add comprehensive README

Documents the full system: architecture, phases 1-8, workflow diagrams,
tech stack, running instructions, design principles, and known issues.

Reframes the project as a production-style AI automation system rather
than a chatbot: LLM reasons, code decides, human-in-the-loop, idempotent,
auditable."
````

Want me to write the Phase 9 prompt next, or would you like to polish anything in the README first?
