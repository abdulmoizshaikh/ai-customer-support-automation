# AI Customer Support Automation Platform

A locally-hosted AI automation system that classifies customer support tickets, retrieves company policies via RAG (Retrieval-Augmented Generation), evaluates deterministic business rules, executes low-risk actions automatically, and routes high-risk actions through human approval — with every step recorded in an auditable execution trace.

**Built as a demonstration of real backend automation, not a chatbot wrapper.**

---

## Table of Contents

**Part 1 — Business Context**

1. [Why This Project Exists](#1-why-this-project-exists)
2. [What Problem It Solves](#2-what-problem-it-solves)
3. [Business Value and ROI](#3-business-value-and-roi)
4. [Business Use Cases](#4-business-use-cases)
5. [What Can Be Automated](#5-what-can-be-automated)

**Part 2 — Users and Roles** 6. [User Roles Explained](#6-user-roles-explained) 7. [Permissions Matrix](#7-permissions-matrix) 8. [Authentication and Authorization Flow](#8-authentication-and-authorization-flow)

**Part 3 — Architecture** 9. [System Architecture](#9-system-architecture) 10. [Technology Stack](#10-technology-stack) 11. [The Full Workflow (High Level)](#11-the-full-workflow-high-level)

**Part 4 — Detailed Processes** 12. [Process 1 — Customer Ticket Submission](#12-process-1--customer-ticket-submission) 13. [Process 2 — AI Classification](#13-process-2--ai-classification) 14. [Process 3 — RAG Policy Retrieval](#14-process-3--rag-policy-retrieval) 15. [Process 4 — Decision Engine Evaluation](#15-process-4--decision-engine-evaluation) 16. [Process 5 — Auto-Refund Execution](#16-process-5--auto-refund-execution) 17. [Process 6 — Human Approval Workflow](#17-process-6--human-approval-workflow) 18. [Process 7 — Response Generation](#18-process-7--response-generation) 19. [Process 8 — Audit Trail and Execution Trace](#19-process-8--audit-trail-and-execution-trace) 20. [Process 9 — Analytics and Observability](#20-process-9--analytics-and-observability) 21. [Process 10 — Rate Limiting and Abuse Prevention](#21-process-10--rate-limiting-and-abuse-prevention)

**Part 5 — Development** 22. [Development Phases](#22-development-phases) 23. [Directory Layout](#23-directory-layout) 24. [Running Locally](#24-running-locally) 25. [Configuration](#25-configuration) 26. [Testing](#26-testing)

**Part 6 — Principles** 27. [Key Design Principles](#27-key-design-principles) 28. [Mock vs Real Providers](#28-mock-vs-real-providers) 29. [Known Issues and Roadmap](#29-known-issues-and-roadmap)

---

# Part 1 — Business Context

## 1. Why This Project Exists

Most "AI automation" projects are chat wrappers: prompt in, text out, no structure, no safety, no audit trail. That works for a demo but fails in production because:

- The LLM hallucinates financial decisions
- There's no way to enforce company policy
- Nothing is logged
- Regulators ask "why was this refund issued?" and there's no answer
- A single bad prompt costs real money

Real business automation requires six things a chat wrapper doesn't have:

| Requirement                    | Why It Matters                             | How This Project Delivers              |
| ------------------------------ | ------------------------------------------ | -------------------------------------- |
| **Structured AI output**       | Raw LLM text can't feed downstream systems | zod-validated JSON schema              |
| **Company-specific knowledge** | Generic LLMs don't know your policies      | RAG over your policy documents         |
| **Deterministic decisions**    | AI shouldn't decide who gets money         | Pure business rules engine             |
| **Human oversight**            | High-value actions need review             | Approval queue for amounts > threshold |
| **Idempotency**                | Retries must not double-refund             | Unique constraints per ticket          |
| **Complete audit trail**       | Every action traceable                     | Structured AuditLog per event          |

The core architectural principle:

> **AI reasons; code decides.**

The LLM reads the customer's message and classifies it. Code enforces business rules, executes financial actions, and writes the audit log. The LLM never has direct authority over a refund, cancellation, or any other consequential action.

## 2. What Problem It Solves

Customer support teams face a recurring set of pain points:

### Problem 1: Manual triage of routine work

**Reality:** 60–80% of inbound tickets are routine — order status, refund requests, shipping questions. Agents spend most of their time on work that could be automated.

**Solution:** Every ticket is classified in seconds. Routine cases resolve automatically.

### Problem 2: Inconsistent policy enforcement

**Reality:** Different agents interpret "30-day refund window" differently. One approves a 31-day-old order, another rejects a 29-day-old one. Customers complain about inconsistency.

**Solution:** A pure decision engine enforces policy uniformly. Every branch is tested. Same input always produces the same output.

### Problem 3: Slow response times

**Reality:** A simple refund request waits 4–8 hours for a human to read one line of policy and click approve.

**Solution:** Low-value refunds process in 2–3 seconds. High-value ones queue immediately with structured context for the reviewer.

### Problem 4: No audit trail

**Reality:** When a refund goes wrong, no one can reconstruct who did what, when, or why. Compliance is a nightmare.

**Solution:** Every state change writes a structured `AuditLog` row with actor, event, and JSON metadata. Full replay is possible from the audit log alone.

### Problem 5: Scaling costs

**Reality:** Doubling ticket volume means doubling headcount, even when the added volume is routine.

**Solution:** ~70% automation rate for routine cases. Headcount scales sub-linearly with volume.

## 3. Business Value and ROI

### For a mid-size e-commerce business (~10,000 tickets/month)

| Metric                        | Before          | After                        | Improvement   |
| ----------------------------- | --------------- | ---------------------------- | ------------- |
| Average first-response time   | 4–8 hours       | < 30 seconds                 | 500× faster   |
| Refund processing (low-value) | 1–2 days        | Instant                      | 1000× faster  |
| Support agents needed         | 8 FTE           | 3 FTE + 5 escalation-focused | 62% reduction |
| Policy consistency            | Agent-dependent | Policy-enforced              | 100%          |
| Audit trail completeness      | ~40%            | 100%                         | Complete      |
| Monthly operating cost        | ~$40,000        | ~$15,000                     | 62% savings   |
| Payback period                | —               | 2–3 months                   | —             |

### Where the value concentrates

1. **Routine refunds** — low-value, policy-compliant cases processed automatically in seconds
2. **Order status queries** — answered instantly via RAG + order lookup
3. **Escalation quality** — agents see structured context (classification, policy, decision), not raw messages
4. **Compliance** — every action is auditable; regulators and internal audit can reconstruct any decision
5. **Scale without headcount** — 10× ticket volume without 10× cost

## 4. Business Use Cases

### Use Case 1: E-commerce refund automation

**Scenario:** Customer reports a damaged order and requests a refund.

**Flow:**

- AI classifies as `damaged_order`
- RAG retrieves the refund policy
- Decision engine checks: is the order real, delivered, within window, below threshold?
- If yes → auto-refund in seconds
- If no → escalate or reject with reason

**Business impact:** 70% of refund tickets resolved without human touch. Agents focus on complex cases.

### Use Case 2: Order status inquiries

**Scenario:** "Where is my order #456?"

**Flow:**

- AI classifies as `order_status`
- Order lookup returns shipping details
- LLM writes a natural response ("Your order was shipped on... and is expected to arrive...")

**Business impact:** Zero-touch handling of the highest-volume query type.

### Use Case 3: High-value refund escalation

**Scenario:** Customer requests a $2,500 refund.

**Flow:**

- AI classifies and identifies the order
- Decision engine sees $2,500 > $500 threshold
- Creates an `ApprovalRequest` with full context
- Agent sees everything in one screen and clicks approve/reject

**Business impact:** Compliance maintained; agent productivity increased (context is pre-assembled).

### Use Case 4: Policy Q&A

**Scenario:** "What's your return policy?"

**Flow:**

- RAG retrieves the return policy document
- LLM writes a summary response citing the retrieved policy

**Business impact:** Deflects FAQ tickets from human agents; answers are guaranteed to match your actual policy.

### Use Case 5: Fraud/inconsistency detection

**Scenario:** Same customer requests refunds on 5 orders in 24 hours.

**Flow (Phase 11+):**

- Analytics endpoint surfaces the pattern
- Alert fires or auto-escalation triggered
- Audit trail provides the evidence chain

**Business impact:** Early detection of abuse patterns.

## 5. What Can Be Automated

The platform's architecture generalizes to any workflow with these properties:

1. **A natural-language input** (customer message, email, form submission)
2. **A classification** you can define in a schema (intent, priority, entities)
3. **A policy or rule set** that determines correct handling
4. **A safe action** (low-risk: auto-execute) OR **a risky action** (high-risk: human approval)
5. **A response** to send back

### Concrete automation candidates

| Category                   | Example workflows                                                      |
| -------------------------- | ---------------------------------------------------------------------- |
| **Refunds & returns**      | Damaged goods, late delivery, wrong item, policy-compliant refunds     |
| **Order management**       | Status lookup, address change, cancellation, re-shipment               |
| **Billing**                | Invoice requests, subscription cancellation, payment failure follow-up |
| **Access & accounts**      | Password reset, account unlock, subscription upgrade                   |
| **Appointment scheduling** | Reschedule, cancel, confirm, remind                                    |
| **Document intake**        | Classify and route incoming contracts, claims, applications            |
| **Compliance workflows**   | KYC document review, claim eligibility checks                          |
| **Internal IT**            | Ticket triage, access requests, asset provisioning                     |
| **HR/People Ops**          | Leave requests, benefits questions, onboarding tasks                   |
| **Financial ops**          | Expense approval, vendor payment, refund processing                    |

### What NOT to automate

The platform explicitly avoids automating:

- **Legal advice** — always escalate
- **Medical decisions** — always escalate
- **Actions with legal liability** — always require human sign-off
- **Anything without a policy** — if you can't write the rule, don't automate it

The rule: **if you can't deterministically decide who wins and who loses, don't automate the decision.**

---

# Part 2 — Users and Roles

## 6. User Roles Explained

The system defines three distinct roles. Each has a different purpose, a different trust level, and a different scope of authority.

### Role 1: CUSTOMER

**Who they are:**
The end user submitting a support ticket — a real customer of the business.

**What they can do:**

- Submit a ticket via `POST /tickets` (public endpoint)
- Read their own ticket status (planned — currently readback is public for dev)
- Receive the AI-generated response

**What they cannot do:**

- Approve refunds
- See other customers' tickets
- Access analytics
- Trigger admin actions

**Authentication:** None. Customers submit anonymously via a public endpoint.

**Why this matters:** The customer-facing entry point must not require authentication. A customer shouldn't have to create an account just to report a problem with their order. The `POST /tickets` endpoint is `@Public()`.

**What happens when a customer submits:**
The system runs the full workflow (classify → RAG → decision → action) and returns a structured response showing what was decided and why. The customer sees a friendly AI-written message summarizing the outcome.

---

### Role 2: AGENT

**Who they are:**
A human customer support specialist. The person who reviews high-value or ambiguous cases that the AI escalated.

**What they can do:**

- Log in via `POST /auth/login` with email + password
- View all tickets (`GET /tickets`, `GET /tickets/:id`) — including full audit traces
- View pending approvals (`GET /approvals?status=PENDING`)
- Approve refunds (`POST /approvals/:id/approve`)
- Reject refunds with a reason (`POST /approvals/:id/reject`)
- View analytics (`GET /analytics`)
- View the full execution trace of any ticket
- View order and customer data

**What they cannot do:**

- Seed test orders (ADMIN only)
- Retry failed tickets (ADMIN only)
- Manage other users (ADMIN only)

**Authentication:** JWT. Login returns an access token (15-min TTL) and refresh token (7-day TTL).

**Why this matters:** The agent is the human-in-the-loop. They are the last line of defense before a consequential action (a $2,500 refund) is taken. Their decisions must be:

- **Authenticated** — they must be a real employee
- **Authorized** — they must have the AGENT role
- **Auditable** — every action they take is logged with their user ID

**What happens when an agent approves a refund:**
The `ApprovalRequest` moves from `PENDING` to `APPROVED`, a refund is created, the order status transitions to `REFUNDED`, the ticket resolves, and three audit events fire (`APPROVAL_APPROVED`, `ORDER_STATUS_TRANSITIONED`, `TICKET_RESOLVED`). All within a single short transaction.

---

### Role 3: ADMIN

**Who they are:**
A system administrator or platform engineer. The person responsible for the automation system itself — not the front-line support work.

**What they can do:**
Everything an AGENT can do, PLUS:

- Seed test orders (`POST /admin/seed-test-order`) — for repeatable manual verification
- Retry failed tickets (`POST /tickets/:id/retry`) — recovery path for stuck workflows
- Manage users (planned: `POST /users`, `PATCH /users/:id`, etc.)

**What they cannot do:**

- Modify the business rules at runtime (those live in code and env vars — deliberately not runtime-editable to prevent accidental drift)
- Delete audit logs (immutable by design)

**Authentication:** JWT, same as AGENT but with a different role claim.

**Why this matters:** Admins need operational tools that would be dangerous in an agent's hands. Seeding test orders could be abused to create fake refunds. Retrying failed tickets could mask a pattern of failures. Rate-limiting admin endpoints is deliberately disabled because admins are trusted and use these tools in bursts (e.g., seeding 20 test orders for verification).

**What happens when an admin seeds a test order:**
The `POST /admin/seed-test-order` endpoint inserts a fresh `DELIVERED` order for a seeded customer, returning the generated order ID. This solves a recurring problem during real-LLM verification: after you refund an order once, subsequent tickets on that order hit `ORDER_ALREADY_REFUNDED`. Seeding gives you a fresh target.

---

### Special: SYSTEM (not a role, but an actor)

The audit log has four actors: `HUMAN`, `AI`, `SYSTEM`, `AGENT`. The `SYSTEM` actor is not a user role — it's a marker for automated steps that aren't tied to a specific AI inference or human action:

- Order lookups
- Decision engine evaluations
- Refund creation
- Order status transitions
- Ticket resolution

`SYSTEM` actions are performed by code, on behalf of the workflow. They are still auditable but don't represent a person or an AI inference.

---

## 7. Permissions Matrix

| Endpoint                      | CUSTOMER  |   AGENT   |   ADMIN   | Notes               |
| ----------------------------- | :-------: | :-------: | :-------: | ------------------- |
| `POST /auth/register`         | ✅ public | ✅ public | ✅ public | 5 req/min throttle  |
| `POST /auth/login`            | ✅ public | ✅ public | ✅ public | 10 req/min throttle |
| `POST /auth/refresh`          | ✅ public | ✅ public | ✅ public | —                   |
| `GET /auth/me`                |    ❌     |    ✅     |    ✅     | JWT required        |
| `POST /tickets`               | ✅ public | ✅ public | ✅ public | 20 req/min throttle |
| `GET /tickets`                |    ❌     |    ✅     |    ✅     | JWT required        |
| `GET /tickets/:id`            |    ❌     |    ✅     |    ✅     | JWT required        |
| `POST /tickets/:id/retry`     |    ❌     |    ❌     |    ✅     | ADMIN only          |
| `POST /approvals/:id/approve` |    ❌     |    ✅     |    ✅     | JWT + role          |
| `POST /approvals/:id/reject`  |    ❌     |    ✅     |    ✅     | JWT + role          |
| `GET /approvals`              |    ❌     |    ✅     |    ✅     | JWT + role          |
| `GET /analytics`              |    ❌     |    ✅     |    ✅     | JWT + role          |
| `POST /admin/seed-test-order` |    ❌     |    ❌     |    ✅     | ADMIN only          |
| `POST /ai/classify`           | ✅ public | ✅ public | ✅ public | Dev/test endpoint   |
| `GET /knowledge/search`       | ✅ public | ✅ public | ✅ public | Dev/test endpoint   |
| `GET /orders/:id`             |    ❌     |    ✅     |    ✅     | JWT required        |

**Legend:**

- ✅ **public** — no authentication required
- ✅ **JWT required** — valid access token needed
- ✅ **JWT + role** — valid access token AND specific role
- ❌ — forbidden (401 if no token, 403 if token lacks role)

---

## 8. Authentication and Authorization Flow

### How a user logs in

```text
   ┌─────────────────────────────────────────────────────────┐
   │  Browser: POST /api/auth/login                          │
   │  { "email": "agent@example.com",                        │
   │    "password": "Agent123!" }                            │
   └──────────────────────┬──────────────────────────────────┘
                          │
                          ▼
   ┌─────────────────────────────────────────────────────────┐
   │  AuthController.login(dto)                              │
   │                                                         │
   │  1. Look up user by email via Prisma                    │
   │  2. bcrypt.compare(password, user.passwordHash)         │
   │     ├─ mismatch → 401 Unauthorized                      │
   │     └─ match → continue                                 │
   │  3. Sign access token (JWT, 15-min TTL)                 │
   │     payload: { sub: userId, email, role }               │
   │  4. Sign refresh token (JWT, 7-day TTL)                 │
   │  5. Return { user, tokens: { accessToken, refreshToken }} │
   └──────────────────────┬──────────────────────────────────┘
                          │
                          ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Frontend stores tokens in sessionStorage               │
   │  (not localStorage — cleared when tab closes)           │
   │                                                         │
   │  Subsequent requests:                                    │
   │    Authorization: Bearer <accessToken>                  │
   └─────────────────────────────────────────────────────────┘
```

### How authorization is enforced on every request

Three global guards run in order for every incoming request:

```text
   Request arrives
        │
        ▼
   ┌───────────────────────────────────────────────────┐
   │  Guard 1: ThrottlerGuard                          │
   │  Checks rate limit for this IP + route            │
   │  └─ exceeded → 429 Too Many Requests              │
   └───────────────────────┬───────────────────────────┘
                           │
                           ▼
   ┌───────────────────────────────────────────────────┐
   │  Guard 2: JwtAuthGuard                            │
   │  1. Check @Public() metadata on route             │
   │     └─ true → allow through (skip auth)           │
   │  2. Extract Bearer token from Authorization header│
   │     └─ missing → 401 "Missing access token"       │
   │  3. Verify signature with JWT_ACCESS_SECRET       │
   │     └─ invalid/expired → 401                      │
   │  4. Attach decoded payload to request.user        │
   └───────────────────────┬───────────────────────────┘
                           │
                           ▼
   ┌───────────────────────────────────────────────────┐
   │  Guard 3: RolesGuard                              │
   │  1. Read @Roles(...) metadata from route          │
   │     └─ none → allow through                       │
   │  2. Read request.user.role                        │
   │     └─ not in required roles → 403 Forbidden      │
   │  3. Allow through                                 │
   └───────────────────────┬───────────────────────────┘
                           │
                           ▼
                    Controller handler
```

**Order matters.** Auth must run before roles (roles need the user). Rate limiting runs first so failed auth attempts also count against the limit.

### Why this matters for business

- **Customers** never need to log in to submit a ticket — friction removed
- **Agents** are authenticated and their role is verified before any consequential action
- **Admins** have a separate role so dangerous tools (seeding, retry) can't be reached by mistake
- **Every request** is rate-limited to prevent abuse
- **Every action** by a human is logged with their identity via `actorId`

---

# Part 3 — Architecture

## 9. System Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌──────────────────────┐         ┌──────────────────────┐         │
│   │  Customer Browser    │         │  Agent Browser       │         │
│   │  (React Dashboard)   │         │  (same React app)    │         │
│   │  localhost:5173      │         │  authenticated view  │         │
│   └──────────┬───────────┘         └──────────┬───────────┘         │
│              │                                │                     │
│              │  POST /tickets (public)        │  GET /approvals     │
│              │                                │  POST /approve      │
│              │                                │  GET /analytics     │
│              │                                │                     │
│              └────────────┬───────────────────┘                     │
│                           │                                         │
│                           ▼                                         │
│              ┌────────────────────────────┐                         │
│              │    Vite Dev Proxy          │                         │
│              │    /api/* → :3000/*        │                         │
│              └────────────┬───────────────┘                         │
│                           │                                         │
│                           ▼                                         │
│              ┌────────────────────────────┐                         │
│              │    NestJS API              │                         │
│              │    localhost:3000          │                         │
│              │                            │                         │
│              │  Guards: Throttler →       │                         │
│              │         JwtAuth →          │                         │
│              │         Roles              │                         │
│              └────────────┬───────────────┘                         │
│                           │                                         │
│      ┌────────────────────┼────────────────────┐                    │
│      │                    │                    │                    │
│      ▼                    ▼                    ▼                    │
│  ┌────────┐        ┌────────────┐        ┌────────────┐             │
│  │Postgres│        │ AI Service │        │  Decision  │             │
│  │pgvector│        │            │        │  Engine    │             │
│  │        │        │ Provider   │        │            │             │
│  │ 9      │        │ interface  │        │  Pure      │             │
│  │ tables │        │            │        │  functions │             │
│  └────────┘        └─────┬──────┘        └────────────┘             │
│                          │                                          │
│                          ▼                                          │
│              ┌────────────────────────────┐                         │
│              │    Ollama Runtime          │                         │
│              │    localhost:11434         │                         │
│              │                            │                         │
│              │  qwen2.5:7b (chat)         │                         │
│              │  nomic-embed-text (embed)  │                         │
│              └────────────────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key properties:**

- **Local-first** — Everything runs on a laptop. No cloud costs. No data leaving the machine when using Ollama.
- **Provider-agnostic** — Same interface works with Ollama, OpenAI, OpenRouter. Switching is one env var.
- **Deterministic where it matters** — Classification uses AI. Business rules and financial actions use code.
- **Fully auditable** — Every state change writes structured audit metadata.

## 10. Technology Stack

| Layer           | Technology                     | Why                                   |
| --------------- | ------------------------------ | ------------------------------------- |
| Backend runtime | Node.js 24                     | Modern, matches existing skill set    |
| Language        | TypeScript (ESM, `nodenext`)   | Type safety; modern module resolution |
| Framework       | NestJS                         | Structure, DI, guards, pipes          |
| ORM             | Prisma 7 (driver adapter)      | Type-safe DB access, migrations       |
| Database        | PostgreSQL 16 + pgvector       | Relational + vector in one store      |
| Auth            | JWT (access + refresh), bcrypt | Stateless, standard, testable         |
| AI runtime      | Ollama                         | Local, no cloud dependency, free      |
| Chat model      | qwen2.5:7b                     | Good instruction-following, 4.7 GB    |
| Embedding model | nomic-embed-text               | 768-dim, fast, local                  |
| Validation      | zod + class-validator          | Structured output at boundaries       |
| Rate limiting   | @nestjs/throttler              | Abuse prevention                      |
| Testing         | Vitest                         | Fast, modern, TS-native               |
| Frontend        | React 18 + TypeScript + Vite   | Standard modern stack                 |
| Server state    | @tanstack/react-query          | Cache + invalidation                  |
| Styling         | Tailwind CSS 3                 | Utility-first, no CSS files           |

## 11. The Full Workflow (High Level)

When a customer submits a ticket, nine steps run:

```text
   1. RECEIVE       Customer message arrives via POST /tickets
                    │
   2. CLASSIFY      AI reads message → { intent, orderId, priority, confidence }
                    │
   3. RETRIEVE      RAG finds relevant policy chunks from knowledge base
                    │
   4. LOOKUP        Order data fetched from database
                    │
   5. DECIDE        Deterministic rules evaluate → action
                    │
   6. ACT           Execute: refund, escalate, or reject
                    │
   7. RESPOND       AI writes customer reply using policy context
                    │
   8. AUDIT         Every step writes structured metadata
                    │
   9. RETURN        Full response with execution trace
```

Each step is detailed in Part 4 below.

---

# Part 4 — Detailed Processes

## 12. Process 1 — Customer Ticket Submission

### What happens

Customer submits a message. The system creates a ticket and begins processing.

### Flow

```text
   ┌──────────────────────────────────────────────────────┐
   │  Frontend: SubmitTicket page                         │
   │                                                      │
   │  User types: "My order #124 arrived damaged.         │
   │               I want a refund."                      │
   │                                                      │
   │  [ Submit Ticket ]                                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        │  POST /api/tickets
                        │  Content-Type: application/json
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Vite proxy rewrites to :3000                        │
   │  POST http://localhost:3000/tickets                  │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  NestJS middleware chain                             │
   │  ─ ThrottlerGuard (20 req/min for /tickets)          │
   │  ─ JwtAuthGuard (@Public() → bypass)                 │
   │  ─ RolesGuard (no @Roles → allow)                    │
   │  ─ ValidationPipe (validate CreateTicketDto)         │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  PHASE 1: Create ticket (short transaction)          │
   │  ─ INSERT Ticket (status='OPEN')                     │
   │  ─ INSERT AuditLog (TICKET_CREATED, actor='HUMAN')   │
   │  ─ COMMIT                                            │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
                    Continue to Process 2
```

### Example request

```bash
curl -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d '{"message":"My order #124 arrived damaged. I want a refund."}'
```

### What this process guarantees

- The ticket is created **before** any LLM work, so a failure later still leaves a record
- `TICKET_CREATED` is always the first audit event
- The message preview is logged (truncated to 80 chars) for later inspection
- Rate limiting protects this public endpoint from abuse

---

## 13. Process 2 — AI Classification

### What happens

The LLM reads the customer's message and returns structured information: what they want, which order they're referring to, how urgent it is, and how confident the model is.

### Flow

```text
   ┌──────────────────────────────────────────────────────┐
   │  AiService.classifyTicket(message)                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  OpenAICompatibleProvider.classifyTicket()           │
   │                                                      │
   │  POST http://localhost:11434/v1/chat/completions     │
   │  {                                                   │
   │    "model": "qwen2.5:7b",                            │
   │    "messages": [                                     │
   │      { "role": "system",                             │
   │        "content": "You are a classifier. Return      │
   │          ONLY valid JSON matching this schema:       │
   │          { intent, orderId, priority, confidence }"  │
   │      },                                              │
   │      { "role": "user",                               │
   │        "content": "My order #124 arrived damaged..." │
   │      }                                               │
   │    ],                                                │
   │    "temperature": 0,                                 │
   │    "response_format": { "type": "json_object" }      │
   │  }                                                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  qwen2.5:7b generates:                               │
   │  {                                                   │
   │    "intent": "damaged_order",                        │
   │    "orderId": "124",                                 │
   │    "priority": "high",                               │
   │    "confidence": 0.95                                │
   │  }                                                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  zod validation                                      │
   │  ─ intent ∈ 6 valid values ✓                         │
   │  ─ orderId is string or null ✓                       │
   │  ─ priority ∈ {low, medium, high} ✓                  │
   │  ─ confidence ∈ [0, 1] ✓                             │
   │                                                      │
   │  If validation fails → 500 error with details        │
   │  (prevents malformed data from propagating)          │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Short transaction:                                  │
   │  INSERT AuditLog (AI_CLASSIFICATION, actor='AI',     │
   │    metadata={ intent, orderId, priority,             │
   │               confidence, provider: "openai" })      │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
                    Continue to Process 3
```

### Valid intents

| Intent            | Meaning                                     |
| ----------------- | ------------------------------------------- |
| `refund`          | Customer wants money back                   |
| `order_status`    | Customer wants to know where their order is |
| `damaged_order`   | Customer reports a damaged delivery         |
| `cancel_order`    | Customer wants to cancel before delivery    |
| `technical_issue` | Customer reports a bug or app problem       |
| `other`           | Doesn't fit the above                       |

### Why structured output matters

Without zod validation, a hallucinating LLM could return:

```json
{ "intent": "maybe refund", "confidence": "very high" }
```

That would crash downstream code or silently produce garbage. With validation, it fails loudly at the boundary — before any state change happens.

### What this process guarantees

- Classification is **AI-driven** (LLM reads natural language)
- Output is **structured and validated** (zod schema)
- Classification is **recorded** (audit event with provider, confidence)
- Confidence is **captured for later use** (decision engine may reject low confidence)

---

## 14. Process 3 — RAG Policy Retrieval

### What happens

The system finds the company policy documents most relevant to the customer's message.

### Flow

```text
   ┌──────────────────────────────────────────────────────┐
   │  RagService.searchKnowledge(message, topK=3)         │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  EmbeddingsService.embed(message)                    │
   │                                                      │
   │  POST http://localhost:11434/v1/embeddings           │
   │  {                                                   │
   │    "model": "nomic-embed-text",                      │
   │    "input": "My order #124 arrived damaged..."       │
   │  }                                                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Returns a 768-dimensional vector:                   │
   │  [0.021, -0.83, 0.12, ..., 0.44]                     │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  pgvector cosine similarity search                   │
   │                                                      │
   │  SELECT kd.filename, kc.content,                     │
   │         1 - (kc.embedding <=> $1::vector) AS score   │
   │  FROM "KnowledgeChunk" kc                            │
   │  JOIN "KnowledgeDocument" kd ON kd.id = kc."docId"   │
   │  ORDER BY kc.embedding <=> $1::vector                │
   │  LIMIT 3                                             │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Returns top-3 chunks with similarity scores:        │
   │  [                                                   │
   │    { filename: "refund-policy.md",                   │
   │      content: "Customers may request a refund...",   │
   │      score: 0.38 },                                  │
   │    ...                                               │
   │  ]                                                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Short transaction:                                  │
   │  INSERT AuditLog (RAG_RETRIEVED, actor='SYSTEM',     │
   │    metadata={ chunkCount, topScore, filenames })     │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
                    Continue to Process 4
```

### Why RAG matters

Without RAG, the LLM only knows what it learned during training. It has no idea that _your_ refund policy says "30 days" or "orders above $500 need approval."

With RAG, the LLM receives the actual text of your policy documents as context. It can then reason about the customer's case using _your_ rules.

### How the knowledge base is populated

Policy documents live in the `knowledge/` directory as markdown files. They are ingested via:

```bash
curl -X POST http://localhost:3000/knowledge \
  -H 'Content-Type: application/json' \
  -d '{
    "filename": "refund-policy.md",
    "content": "# Refund Policy\n\nCustomers may request..."
  }'
```

Ingestion is **idempotent by filename** — re-ingesting the same file replaces the previous version (including its chunks via CASCADE delete).

### Chunking

Long documents are split into smaller chunks before embedding. The `chunkMarkdown()` function splits on markdown headings first, then on character windows with overlap for very long sections. Each chunk gets its own embedding.

This ensures retrieval returns focused text rather than an entire document.

---

## 15. Process 4 — Decision Engine Evaluation

### What happens

Pure code evaluates business rules against the classified intent, retrieved order data, and configured policy. It returns a structured decision.

### Flow

```text
   ┌──────────────────────────────────────────────────────┐
   │  DecisionService.evaluate({                          │
   │    intent: "damaged_order",                          │
   │    priority: "high",                                 │
   │    confidence: 0.95,                                 │
   │    orderId: "124",                                   │
   │    order: {                                          │
   │      id: "124",                                      │
   │      amount: 100,                                    │
   │      status: "DELIVERED",                            │
   │      deliveredAt: 2026-09-10,                        │
   │      hasCompletedRefund: false                       │
   │    }                                                 │
   │  })                                                  │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Decision rules evaluated in order:                  │
   │                                                      │
   │  1. Is intent refund-family?                         │
   │     damaged_order ✓ → continue                       │
   │                                                      │
   │  2. confidence >= 0.85?                              │
   │     0.95 >= 0.85 ✓ → continue                        │
   │                                                      │
   │  3. Order exists?                                    │
   │     yes ✓ → continue                                 │
   │                                                      │
   │  4. Already refunded?                                │
   │     no ✓ → continue                                  │
   │                                                      │
   │  5. Delivered?                                       │
   │     status === 'DELIVERED' ✓ → continue              │
   │                                                      │
   │  6. Within window?                                   │
   │     delivered 1 day ago <= 30 days ✓ → continue      │
   │                                                      │
   │  7. Amount <= $500?                                  │
   │     $100 <= $500 ✓ → AUTO_REFUND                     │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Returns:                                            │
   │  {                                                   │
   │    action: "AUTO_REFUND",                            │
   │    reason: "ELIGIBLE",                               │
   │    amount: 100,                                      │
   │    requiresApproval: false,                          │
   │    notes: []                                         │
   │  }                                                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Short transaction:                                  │
   │  INSERT AuditLog (DECISION_MADE, actor='SYSTEM',     │
   │    metadata={ action, reason, amount,                │
   │               requiresApproval })                    │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
                    Continue to Process 5, 6, or 7
```

### The seven rules in detail

| #   | Rule                                                  | If false                                 |
| --- | ----------------------------------------------------- | ---------------------------------------- |
| 1   | Intent is refund-family (`refund` or `damaged_order`) | `NO_ACTION`                              |
| 2   | Confidence >= threshold (default 0.85)                | `NEEDS_HUMAN_REVIEW`                     |
| 3   | Order exists in database                              | `ORDER_NOT_FOUND`                        |
| 4   | Not already refunded                                  | `REJECT_REFUND / ORDER_ALREADY_REFUNDED` |
| 5   | Status is `DELIVERED`                                 | `REJECT_REFUND / ORDER_NOT_DELIVERED`    |
| 6   | Days since delivery <= window (default 30)            | `REJECT_REFUND / OUTSIDE_REFUND_WINDOW`  |
| 7   | Amount <= threshold (default $500)                    | `REQUEST_HUMAN_APPROVAL`                 |

### Why this is deterministic, not AI-driven

The LLM decides **what the customer wants** (classification). The decision engine decides **what to do about it**.

This separation is critical:

- **Testability** — 20 test cases cover every branch and every boundary
- **Auditability** — the reason for any decision is captured as a `DecisionReason` enum
- **Consistency** — same inputs always produce the same output
- **Safety** — the LLM can't override policy, no matter how it's prompted

### Boundary test examples

| Input                 | Expected               |
| --------------------- | ---------------------- |
| Amount $500.00        | AUTO_REFUND            |
| Amount $500.01        | REQUEST_HUMAN_APPROVAL |
| Delivered 30 days ago | AUTO_REFUND            |
| Delivered 31 days ago | REJECT_REFUND          |
| Confidence 0.85       | proceed                |
| Confidence 0.84       | NEEDS_HUMAN_REVIEW     |

Every one of these is a test in `decision.engine.spec.ts`.

---

## 16. Process 5 — Auto-Refund Execution

### What happens

When the decision engine returns `AUTO_REFUND`, the system creates a refund and transitions the order.

### Flow

```text
   ┌──────────────────────────────────────────────────────┐
   │  PHASE 3 (short transaction, ~30ms)                  │
   │                                                      │
   │  BEGIN                                               │
   │                                                      │
   │  -- Idempotency check                                │
   │  SELECT * FROM Refund WHERE ticketId = $ticketId     │
   │  ├─ found → return existing (no duplicate)           │
   │  └─ not found → continue                             │
   │                                                      │
   │  -- Create the refund                                │
   │  INSERT INTO Refund (                                │
   │    ticketId, orderId, amount, currency,              │
   │    status='COMPLETED',                               │
   │    reason='Automated refund'                         │
   │  )                                                   │
   │  INSERT AuditLog (REFUND_CREATED, actor='SYSTEM',    │
   │    metadata={ refundId, amount, status })            │
   │                                                      │
   │  -- Transition the order                             │
   │  UPDATE "Order" SET                                  │
   │    status='REFUNDED',                                │
   │    refundedAt=NOW()                                  │
   │  INSERT AuditLog (ORDER_STATUS_TRANSITIONED,         │
   │    actor='SYSTEM',                                   │
   │    metadata={ orderId, from: 'DELIVERED',            │
   │               to: 'REFUNDED' })                      │
   │                                                      │
   │  -- Update the ticket                                │
   │  UPDATE Ticket SET                                   │
   │    status='RESOLVED',                                │
   │    intent='DAMAGED_ORDER',                           │
   │    orderId='124',                                    │
   │    confidence=0.95                                   │
   │                                                      │
   │  COMMIT                                              │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
                    Continue to Process 7 (Response)
```

### Why this is wrapped in a transaction

Everything in Phase 3 must succeed together or fail together:

- If the refund is created but the order isn't updated, data is inconsistent
- If the ticket is updated but the refund isn't created, the customer is told they got a refund they didn't get

The transaction guarantees atomicity for all side effects.

### Idempotency

`Refund.ticketId` has a `@unique` constraint. If the workflow is retried (via the retry endpoint or a manual retry), the refund lookup returns the existing row instead of creating a duplicate.

This is the same principle applied to `POST /knowledge` (idempotent by filename) and would be applied to any future action that has real-world consequences.

---

## 17. Process 6 — Human Approval Workflow

### What happens

When the decision engine returns `REQUEST_HUMAN_APPROVAL` (amount above threshold) or `NEEDS_HUMAN_REVIEW` (low confidence), the workflow pauses for a human.

### Part A — Creating the approval request

```text
   ┌──────────────────────────────────────────────────────┐
   │  PHASE 3 (short transaction)                         │
   │                                                      │
   │  BEGIN                                               │
   │                                                      │
   │  -- No refund created                                │
   │  -- Instead, create an approval request              │
   │                                                      │
   │  INSERT INTO ApprovalRequest (                       │
   │    ticketId,                                         │
   │    type='REFUND',                                    │
   │    amount=750,                                       │
   │    reason='AMOUNT_EXCEEDS_AUTO_THRESHOLD',           │
   │    status='PENDING'                                  │
   │  )                                                   │
   │  INSERT AuditLog (APPROVAL_REQUESTED, actor='AI',    │
   │    metadata={ approvalId, reason, amount })          │
   │                                                      │
   │  -- Update the ticket                                │
   │  UPDATE Ticket SET status='WAITING_APPROVAL'         │
   │                                                      │
   │  COMMIT                                              │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
                    Continue to Process 7 (Response)
                    AI writes a "we'll review" message
                    Ticket waits for human review
```

### Part B — Agent reviews the approval

```text
   ┌──────────────────────────────────────────────────────┐
   │  Frontend: Agent navigates to /approvals             │
   │                                                      │
   │  GET /api/approvals?status=PENDING                   │
   │  Authorization: Bearer <agent JWT>                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  ApprovalQueue page renders:                         │
   │                                                      │
   │  ┌─────────────────────────────────────────────┐     │
   │  │  Ticket #cmtww...                           │     │
   │  │  Order #123  ·  $750.00                     │     │
   │  │  Reason: AMOUNT_EXCEEDS_AUTO_THRESHOLD      │     │
   │  │  Customer: "My order #123 arrived damaged"  │     │
   │  │                                             │     │
   │  │  [ Approve Refund ]  [ Reject ]             │     │
   │  └─────────────────────────────────────────────┘     │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Agent clicks [ Approve Refund ]                     │
   │                                                      │
   │  POST /api/approvals/:id/approve                     │
   │  Authorization: Bearer <agent JWT>                   │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  ApprovalsService.approve(approvalId, agentEmail)    │
   │                                                      │
   │  BEGIN TRANSACTION                                   │
   │                                                      │
   │  -- Validate                                           │
   │  SELECT * FROM ApprovalRequest WHERE id = ?          │
   │  ├─ not found → 404                                  │
   │  ├─ status !== 'PENDING' → 400                       │
   │  └─ PENDING → continue                               │
   │                                                      │
   │  -- Create the refund (idempotent)                   │
   │  INSERT INTO Refund (...)                            │
   │  INSERT AuditLog (REFUND_CREATED)                    │
   │                                                      │
   │  -- Transition the order                             │
   │  UPDATE "Order" SET status='REFUNDED',               │
   │                     refundedAt=NOW()                 │
   │  INSERT AuditLog (ORDER_STATUS_TRANSITIONED)         │
   │                                                      │
   │  -- Resolve the ticket                               │
   │  UPDATE Ticket SET status='RESOLVED'                 │
   │                                                      │
   │  -- Update the approval                              │
   │  UPDATE ApprovalRequest SET                          │
   │    status='APPROVED',                                │
   │    decidedById=<agent userId>,                       │
   │    decidedAt=NOW()                                   │
   │                                                      │
   │  -- Audit                                             │
   │  INSERT AuditLog (APPROVAL_APPROVED, actor='AGENT',  │
   │    metadata={ approvedBy, refundId, amount })        │
   │  INSERT AuditLog (TICKET_RESOLVED,                   │
   │    metadata={ finalStatus: 'RESOLVED',               │
   │               via: 'human-approval' })               │
   │                                                      │
   │  COMMIT                                              │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Frontend refreshes query cache                      │
   │  Ticket now shows:                                    │
   │  ─ status RESOLVED                                    │
   │  ─ refund COMPLETED                                   │
   │  ─ approval APPROVED                                  │
   │  ─ 11-event audit trace                              │
   └──────────────────────────────────────────────────────┘
```

### Part C — Rejecting instead

If the agent clicks `[ Reject ]`:

```text
   BEGIN TRANSACTION
     UPDATE ApprovalRequest SET status='REJECTED',
       decidedById=<agent userId>, decidedAt=NOW()
     UPDATE Ticket SET status='RESOLVED'
     INSERT AuditLog (APPROVAL_REJECTED, actor='AGENT',
       metadata={ rejectedBy, reason })
     INSERT AuditLog (TICKET_RESOLVED,
       metadata={ finalStatus: 'RESOLVED',
                  via: 'human-rejection' })
   COMMIT
```

The ticket resolves (workflow reached a terminal state) but with `via: 'human-rejection'` distinguishing it from an approval.

### Why this design matters

- **The AI never has final authority** over high-value actions
- **The human has full context** — they see the message, order, classification, decision reason
- **The decision is auditable** — the agent's identity is recorded
- **The workflow is recoverable** — if the agent never acts, the approval sits in `PENDING` indefinitely (a separate process could escalate to a manager after N hours)

---

## 18. Process 7 — Response Generation

### What happens

The LLM writes a natural-language response to the customer based on the decision and retrieved policy context.

### Flow

```text
   ┌──────────────────────────────────────────────────────┐
   │  AiService.generateCustomerResponse({                │
   │    message: "My order #124 arrived damaged...",      │
   │    decision: {                                       │
   │      action: "AUTO_REFUND",                          │
   │      amount: 100,                                    │
   │      reason: "ELIGIBLE"                              │
   │    },                                                │
   │    order: {                                          │
   │      id: "124", amount: 100, status: "DELIVERED"     │
   │    },                                                │
   │    policyChunks: [                                   │
   │      { filename: "refund-policy.md",                 │
   │        content: "Customers may request a refund..." }│
   │    ]                                                 │
   │  })                                                  │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Prompt sent to qwen2.5:7b:                          │
   │                                                      │
   │  System: "You are a customer support agent. Write a  │
   │  short, friendly reply based on the decision and     │
   │  policy context. Do not invent facts. Do not promise │
   │  anything beyond the decision."                      │
   │                                                      │
   │  User: "Customer message: ...                        │
   │         Decision: AUTO_REFUND of $100.00             │
   │         Policy context: Customers may request a      │
   │         refund within 30 days..."                    │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  LLM writes:                                         │
   │                                                      │
   │  "Thank you for bringing this to our attention.      │
   │   We've processed an automatic refund of $100.00    │
   │   for your damaged order. If you need any further    │
   │   assistance, feel free to ask!"                     │
   └────────────────────┬─────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Short transaction:                                  │
   │  INSERT AuditLog (RESPONSE_GENERATED, actor='AI',    │
   │    metadata={ action, length })                      │
   │  UPDATE Ticket SET aiResponse='...'                  │
   │  INSERT AuditLog (TICKET_RESOLVED, actor='SYSTEM',   │
   │    metadata={ finalStatus })                         │
   └──────────────────────────────────────────────────────┘
```

### Response templates by decision action

The mock provider uses deterministic templates for testing:

| Decision action          | Response template                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `AUTO_REFUND`            | "Good news — your refund of $X has been approved and is processing."                                  |
| `REQUEST_HUMAN_APPROVAL` | "Your request has been received. Because of the amount, a support specialist will review it shortly." |
| `REJECT_REFUND`          | "We're unable to process a refund for this order. Reason: <reason>."                                  |
| `ORDER_NOT_FOUND`        | "We couldn't find an order matching your message. Please reply with your order number."               |
| `NEEDS_HUMAN_REVIEW`     | "Thanks for reaching out. A support specialist will review your request shortly."                     |
| `NO_ACTION`              | "Thanks for your message. A support specialist will follow up shortly."                               |

The real provider writes free-form responses but is instructed not to invent facts or promise anything beyond the decision.

### Why response generation happens after the decision

The LLM must not decide _whether_ to refund. It only writes _how_ to say the outcome. This separation is what makes the system safe — the response cannot override or contradict the decision engine.

---

## 19. Process 8 — Audit Trail and Execution Trace

### What happens

Every state change writes a structured `AuditLog` row. The audit trail is the source of truth for what happened.

### Schema

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  ticketId  String
  ticket    Ticket   @relation(...)
  event     String
  actor     String   // HUMAN | AI | SYSTEM | AGENT
  actorId   String?  // user id for human/agent actions
  metadata  Json?
  createdAt DateTime @default(now())
}
```

### Event catalog

| Event                       | Actor  | When                                            |
| --------------------------- | ------ | ----------------------------------------------- |
| `TICKET_CREATED`            | HUMAN  | Ticket received                                 |
| `AI_CLASSIFICATION`         | AI     | Intent + order + priority + confidence produced |
| `RAG_RETRIEVED`             | SYSTEM | Policy chunks retrieved                         |
| `ORDER_LOOKED_UP`           | SYSTEM | Order data fetched                              |
| `DECISION_MADE`             | SYSTEM | Decision engine produced an action              |
| `REFUND_CREATED`            | SYSTEM | Refund row created                              |
| `ORDER_STATUS_TRANSITIONED` | SYSTEM | Order status changed                            |
| `APPROVAL_REQUESTED`        | AI     | Escalated for human review                      |
| `APPROVAL_APPROVED`         | AGENT  | Agent approved                                  |
| `APPROVAL_REJECTED`         | AGENT  | Agent rejected                                  |
| `RESPONSE_GENERATED`        | AI     | Customer reply written                          |
| `TICKET_RESOLVED`           | SYSTEM | Workflow reached terminal state                 |
| `TICKET_FAILED`             | SYSTEM | Workflow errored                                |
| `TICKET_RETRY_SUCCEEDED`    | SYSTEM | Admin retried a failed ticket                   |
| `TICKET_RETRY_FAILED`       | SYSTEM | Retry also failed                               |

### How the trace is read

```bash
curl http://localhost:3000/tickets/:id
```

Returns the ticket with its `auditLogs` array in chronological order. This is the **execution trace** — the full story of what happened.

### How the trace is visualized

The frontend's `TicketDetail` page renders the audit log as a vertical timeline:

```text
   ┌──────────────────────────────────────────┐
   │  AI EXECUTION TRACE                      │
   │  9 events · 18.3s total                  │
   │                                          │
   │  ● Ticket received      HUMAN   +0ms     │
   │  │  "My order #901..."                   │
   │  │                                       │
   │  ● AI classified        AI      +5.5s    │
   │  │  intent: refund  confidence: 90%      │
   │  │  provider: openai                     │
   │  │                                       │
   │  ● Policies retrieved   SYSTEM  +120ms   │
   │  │  refund-policy.md (1 chunk)           │
   │  │                                       │
   │  ● Order looked up      SYSTEM  +11ms    │
   │  │  #901 · $80 · DELIVERED               │
   │  │                                       │
   │  ● Decision made        SYSTEM  +6ms     │
   │  │  AUTO_REFUND · ELIGIBLE               │
   │  │                                       │
   │  ● Refund issued        SYSTEM  +19ms    │
   │  │  $80 · COMPLETED                      │
   │  │                                       │
   │  ● Order updated        SYSTEM  +3ms     │
   │  │  DELIVERED → REFUNDED                 │
   │  │                                       │
   │  ● Response written     AI      +12.6s   │
   │  │  169 chars                            │
   │  │                                       │
   │  ● Ticket resolved      SYSTEM  +6ms     │
   │  │  finalStatus: RESOLVED                │
   └──────────────────────────────────────────┘
```

The **elapsed time deltas** (`+5.5s`, `+120ms`, `+12.6s`) are the killer feature — they make latency visible. The two LLM calls stand out immediately. Everything else is sub-100ms. This is what proves the transaction refactor works.

### Why this matters for business

- **Compliance** — regulators and internal audit can reconstruct any decision
- **Debugging** — when something goes wrong, the trace shows exactly where
- **Trust** — customers can be shown the trace if they dispute a decision
- **Learning** — patterns in traces inform improvements (e.g., "LLM is consistently low-confidence on X")

---

## 20. Process 9 — Analytics and Observability

### What happens

Aggregated metrics are available via `GET /analytics` (AGENT or ADMIN).

### Metrics returned

```json
{
  "tickets": {
    "total": 250,
    "resolved": 180,
    "waitingApproval": 12,
    "failed": 3,
    "open": 55
  },
  "automation": {
    "automatedCount": 140,
    "escalatedCount": 32,
    "rejectedCount": 8,
    "automationRate": 0.7778
  },
  "approvals": {
    "pending": 12,
    "approved": 28,
    "rejected": 4
  },
  "refunds": {
    "count": 140,
    "totalAmount": 22450,
    "currency": "USD"
  },
  "ai": {
    "averageConfidence": 0.9123,
    "providerCounts": { "mock": 220, "openai": 30 }
  }
}
```

### Business interpretation

| Metric                 | What it tells you                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Automation rate**    | % of tickets resolved without human touch — the key ROI metric                         |
| **Escalated count**    | How often high-value or ambiguous cases route to humans                                |
| **Rejected count**     | Tickets where the customer's request wasn't granted (policy violation, out of window)  |
| **Average confidence** | AI classification quality — trending down means the classification prompt needs tuning |
| **Provider counts**    | How many tickets were processed by mock vs. real LLM — useful for verification         |

### How it's computed

The analytics endpoint uses `$queryRaw` to aggregate over the audit log's JSON metadata:

```sql
SELECT COUNT(*) FROM "AuditLog"
WHERE event = 'DECISION_MADE'
  AND metadata->>'action' = 'AUTO_REFUND';
```

This works because the audit log has structured metadata. If the metadata were free-form text, this query would be impossible.

---

## 21. Process 10 — Rate Limiting and Abuse Prevention

### What happens

Global rate limiting protects public endpoints from abuse.

### Configuration

| Endpoint                | Limit                    | Why                           |
| ----------------------- | ------------------------ | ----------------------------- |
| Default (all endpoints) | 60 req/min per IP        | Baseline protection           |
| `POST /auth/login`      | 10 req/min per IP        | Prevent credential stuffing   |
| `POST /auth/register`   | 5 req/min per IP         | Prevent mass account creation |
| `POST /tickets`         | 20 req/min per IP        | Prevent spam tickets          |
| Authenticated endpoints | Not separately throttled | Trusted users                 |

### Flow

```text
   Request arrives
        │
        ▼
   ┌──────────────────────────────────────┐
   │  ThrottlerGuard                      │
   │                                      │
   │  1. Identify client (IP)             │
   │  2. Look up route limit              │
   │  3. Count requests in window         │
   │     ├─ under limit → continue        │
   │     └─ over limit → 429              │
   └──────────────┬───────────────────────┘
                  │
                  ▼
              JwtAuthGuard → RolesGuard → Controller
```

### Why stricter limits on auth endpoints

Login and register are the two most attacked endpoints in any public API:

- **Login** — attackers try passwords in bulk (credential stuffing)
- **Register** — attackers create throwaway accounts

Stricter limits reduce damage without affecting legitimate users (real users don't log in 10 times per minute).

### What happens when the limit is hit

```json
HTTP/1.1 429 Too Many Requests
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

The client should back off and retry after the window expires.

---

# Part 5 — Development

## 22. Development Phases

The project was built in ten phases, each adding one capability while preserving all prior functionality.

| Phase  | What was built                                                                         | Key outcome                         |
| ------ | -------------------------------------------------------------------------------------- | ----------------------------------- |
| **1**  | NestJS + Prisma 7 + PostgreSQL + pgvector + schema + seed                              | Foundation with all data structures |
| **2**  | REST API for orders, customers, refunds                                                | Working backend before AI           |
| **3**  | JWT auth, roles, guards (built, not yet registered)                                    | Auth scaffolding                    |
| **4**  | AIProvider interface, mock + OpenAI-compatible providers, zod-validated classification | Safe LLM integration                |
| **5**  | EmbeddingProvider, RAG with pgvector, chunking, idempotent ingestion                   | Company-specific knowledge          |
| **6**  | Pure decision engine, 16 scenario tests                                                | Deterministic business rules        |
| **7**  | Ticket workflow orchestration, audit log, response generation                          | Every subsystem converges           |
| **8**  | Global auth guard registration, approval workflow, refund wrinkles                     | Human-in-the-loop                   |
| **9**  | Admin seed endpoint, retry, rate limiting, analytics, E2E test                         | Production hardening                |
| **10** | React dashboard, execution trace visualization, approval queue                         | Demoable system                     |

Each phase is documented in `.opencode/context/progress.md` and `.opencode/context/roadmap.md`.

## 23. Directory Layout

```text
ai-customer-support/
├── backend/                        ← NestJS application
│   ├── prisma/
│   │   ├── schema.prisma           ← data model
│   │   ├── seed.ts                 ← seed data
│   │   └── migrations/             ← migration history
│   ├── src/
│   │   ├── admin/                  ← Phase 9: seed-test-order
│   │   ├── ai/                     ← Phase 4: classification
│   │   ├── analytics/              ← Phase 9: metrics
│   │   ├── approvals/              ← Phase 8: human-in-the-loop
│   │   ├── audit/                  ← Phase 7: execution trace
│   │   ├── auth/                   ← Phase 3: JWT + roles
│   │   ├── common/                 ← guards, decorators, config
│   │   ├── customers/              ← Phase 2
│   │   ├── decision/               ← Phase 6: business rules
│   │   ├── embeddings/             ← Phase 5: vectors
│   │   ├── orders/                 ← Phase 2
│   │   ├── rag/                    ← Phase 5: retrieval
│   │   ├── refunds/                ← Phase 2, extended in 8
│   │   ├── tickets/                ← Phase 7: orchestrator
│   │   └── users/                  ← Phase 3
│   ├── test/e2e/                   ← Phase 9: end-to-end test
│   ├── .env.example                ← documented env vars
│   ├── .env.mock-backup            ← snapshot for mock providers
│   └── .env.openai-backup          ← snapshot for real providers
├── frontend/                       ← React dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuditTimeline.tsx   ← THE execution trace visualizer
│   │   │   ├── Layout.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── SubmitTicket.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── TicketList.tsx
│   │   │   ├── TicketDetail.tsx
│   │   │   ├── ApprovalQueue.tsx
│   │   │   └── Analytics.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   ├── format.ts
│   │   │   └── types.ts
│   │   └── App.tsx
│   └── vite.config.ts              ← /api proxy to backend
├── knowledge/                      ← policy documents (markdown)
├── docker-compose.yml              ← PostgreSQL + pgvector
└── README.md                       ← this file
```

## 24. Running Locally

### Prerequisites

- Node.js 20+
- Docker
- Ollama (only for real-LLM mode)

### Setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
# Server on http://localhost:3000

# 3. Frontend (in a new terminal)
cd frontend
npm install
npm run dev
# Dashboard on http://localhost:5173
```

### Test the workflow

```bash
curl -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d '{"message":"My order #124 arrived damaged. I want a refund."}'
```

Or open `http://localhost:5173` in a browser and use the demo buttons.

### Real LLM mode

```bash
# 1. Pull models
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 2. Switch providers
cp backend/.env.openai-backup backend/.env

# 3. Restart backend
cd backend && npm run start:dev
```

Now each ticket takes 15–30 seconds (real LLM inference) instead of 0.2 seconds (mock).

### Switching providers

Use the snapshot pattern — never `sed` on `.env`:

```bash
# To real:
cp .env.openai-backup .env

# To mock:
cp .env.mock-backup .env
```

## 25. Configuration

All config lives in `.env`. Key variables:

```env
# Core
DATABASE_URL="postgresql://ai_support:ai_support@localhost:5432/ai_support"
PORT=3000

# Auth
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"

# AI provider
AI_PROVIDER=mock                  # mock | openai
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=                       # empty for Ollama
AI_CHAT_MODEL=qwen2.5:7b

# Embeddings
EMBEDDING_PROVIDER=mock           # mock | openai
AI_EMBED_MODEL=nomic-embed-text
EMBEDDING_DIMS=768

# Business rules
REFUND_WINDOW_DAYS=30
AUTO_REFUND_THRESHOLD=500
CONFIDENCE_THRESHOLD=0.85
```

### Business rules are configurable

| Variable                | Default | Effect                                             |
| ----------------------- | ------- | -------------------------------------------------- |
| `REFUND_WINDOW_DAYS`    | 30      | Orders delivered more than N days ago are rejected |
| `AUTO_REFUND_THRESHOLD` | 500     | Amounts above N require human approval             |
| `CONFIDENCE_THRESHOLD`  | 0.85    | Classifications below N route to human review      |

Changing these in `.env` changes the business rules at runtime — no code changes needed.

## 26. Testing

### Unit tests

```bash
cd backend
npx vitest run
```

**54 tests across 7 files:**

- `decision.engine.spec.ts` — 20 cases (boundaries, precedence, wrinkles)
- `chunking.spec.ts` — 8 cases
- `mock.provider.spec.ts` — 8 cases
- `mock-embedding.provider.spec.ts` — 5 cases
- `ticket.service.spec.ts` — 6 cases
- `approvals.service.spec.ts` — 6 cases
- `refunds` — 1 case

All use mock providers — no Ollama, no network, deterministic.

### E2E tests

```bash
cd backend
npm run test:e2e
```

**6 cases against a real PostgreSQL database** (mocked providers):

1. Low-value damaged order → AUTO_REFUND
2. High-value → REQUEST_HUMAN_APPROVAL
3. Outside window → REJECT_REFUND
4. Nonexistent order → ORDER_NOT_FOUND
5. Full approval flow (submit → approve → refund)
6. Idempotency: re-refunding the same order

The E2E test forces `AI_PROVIDER=mock` in `beforeAll`, ignoring `.env` — so it's deterministic regardless of local config.

### Real-LLM verification

For manual verification with Ollama:

```bash
# 1. Ensure .env points to openai
cp .env.openai-backup .env

# 2. Restart server
npm run start:dev

# 3. Seed a fresh test order (avoids ORDER_ALREADY_REFUNDED)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens']['accessToken'])")

ORDER_ID=$(curl -s -X POST http://localhost:3000/admin/seed-test-order \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":75}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['orderId'])")

# 4. Submit a ticket
time curl -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d "{\"message\":\"My order #$ORDER_ID arrived damaged. I want a refund.\"}"

# 5. Restore mock when done
cp .env.mock-backup .env
```

---

# Part 6 — Principles

## 27. Key Design Principles

### 1. AI reasons; code decides

The LLM classifies intent. Code decides whether a refund is allowed. Never the reverse.

```text
LLM:     "This looks like a refund request."
Backend: "Let me verify the order."
Rules:   "Order is 45 days old — outside the 30-day window."
Result:  REJECT_REFUND
```

### 2. Validate at the boundary

LLM output is parsed through a zod schema the moment it arrives. If it doesn't conform, the request fails loudly.

### 3. Keep DB transactions short

**Never hold a transaction open across an external API call.** This was learned the hard way — the first version wrapped the entire workflow in one `$transaction` and timed out under real LLM latency. The refactor split it into five phases, each sub-second.

### 4. Idempotency by natural key

- RAG ingestion is idempotent by `filename`
- Refunds are idempotent by `ticketId` (unique constraint)
- Retry logic checks for existing side effects before creating new ones

### 5. Audit is not logging

Every state change writes a structured `AuditLog` row with actor, event, and JSON metadata. Audit writes participate in the same transaction as the change they record.

### 6. Deterministic tests over AI tests

The decision engine has 20 test cases. None touch an LLM. Every branch and boundary is verified. Real-LLM behavior is verified manually, not in CI.

### 7. Mock providers are real implementations

The mock isn't a stub. It correctly classifies every seeded scenario and produces deterministic embeddings with meaningful cosine similarity.

## 28. Mock vs Real Providers

| Concern           | Mock             | Real (Ollama)           |
| ----------------- | ---------------- | ----------------------- |
| Test speed        | <1s per workflow | 15–60s per workflow     |
| Determinism       | 100%             | Variable                |
| External services | None             | Ollama + 4.7 GB model   |
| CI-friendliness   | Perfect          | Requires setup          |
| Portfolio demo    | Runs anywhere    | Requires model download |

Both providers implement the same interfaces (`AIProvider`, `EmbeddingProvider`). Switching is one env var.

## 29. Known Issues and Roadmap

### Known Issues

**Cross-provider embedding mismatch:** Knowledge chunks ingested with one embedding provider are incomparable to queries embedded with a different provider. Document ranking still works within a provider, but cross-provider scores are meaningless. Fix: store embedding model name per chunk; reject searches across models; re-embed on model change.

**No vector index:** `KnowledgeChunk.embedding` has no HNSW or IVFFlat index. Fine at current scale (single-digit chunks), but sequential scan will dominate at 1000+ chunks.

**Partial-commit recovery:** If Phase 4 or 5 fails after Phase 3 commits, the ticket is marked `FAILED` but committed side effects remain. A retry endpoint exists (`POST /tickets/:id/retry`) but is manual.

**Ticket readback is public:** `GET /tickets` and `GET /tickets/:id` don't require authentication. Should be scoped when customer auth is defined.

### Roadmap

**Phase 11 — Production deployment**

- Dockerfile for backend (multi-stage build)
- Docker Compose service for frontend + backend + postgres + ollama
- Environment-based config for staging/production

**Phase 12 — Advanced RAG**

- HNSW index on embeddings
- Model-versioned embeddings (re-embed on change)
- Query rewriting for short queries
- Multi-document retrieval with re-ranking

**Phase 13 — Extended workflows**

- Digital product refunds (non-refundable via policy)
- Multi-currency support
- Order cancellation flow
- Re-shipment flow

**Phase 14 — Enterprise features**

- SSO integration
- Audit log export (CSV, JSON)
- Retention policies
- Multi-tenant support

---

## License

MIT (or your choice).

## Credits

Built as a portfolio project demonstrating production-grade AI automation patterns: LLM classification + structured output + RAG + tool calling + deterministic business rules + human-in-the-loop + audit logging.

The architecture is intentionally modular: any single piece (the LLM, the embedding model, the payment provider, the vector store) can be swapped without touching the others.
