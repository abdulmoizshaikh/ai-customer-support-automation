# Local AI Customer Support Automation

## Project Overview

This project is a completely local AI customer support automation
system.

The goal is to build a production-style AI support workflow that can:

1. Receive customer support tickets
2. Classify the ticket using an LLM
3. Retrieve relevant knowledge using RAG
4. Look up customer/order information
5. Determine the appropriate action
6. Execute safe automated actions
7. Escalate uncertain or sensitive cases to a human

The entire project should be runnable locally and should prioritize
free/local AI models and open-source tools.

---

## Core Workflow

Customer
↓
Support Ticket
↓
AI Classification
↓
RAG / Knowledge Retrieval
↓
Customer / Order Lookup
↓
AI Decision
↓
Action
↓
Response / Human Escalation

Example:

"My order #123 arrived damaged. I want a refund."

Expected workflow:

1. Detect intent = refund request
2. Extract order ID = 123
3. Retrieve order information
4. Retrieve refund policy
5. Determine eligibility
6. Decide whether automatic refund is allowed
7. Execute refund or escalate
8. Generate customer response

---

## Development Principles

- Build incrementally.
- Prefer simple architecture before introducing complexity.
- Keep the system completely runnable locally.
- Avoid unnecessary paid APIs.
- Do not invent functionality that has not been implemented.
- Do not modify unrelated files.
- Before implementing major features, inspect the existing architecture.
- Reuse existing utilities and services when possible.
- Write maintainable production-style code.

---

## AI Principles

The AI must not directly perform dangerous business actions without
validation.

AI should:

1. Understand the request
2. Gather evidence
3. Make a structured decision
4. Validate the decision
5. Execute an allowed tool/action
6. Record the result

Use structured outputs where appropriate.

Do not rely on free-form LLM responses for business-critical logic.

---

## Current Architecture

[Update this section as architecture evolves.]

Backend:

- Node.js
- TypeScript
- [framework]

AI:

- [local model]
- [embedding model]
- [vector database]

Database:

- [database]

Frontend:

- [framework]

---

## Important Rules

Before implementing a feature:

1. Read relevant documentation under `docs/`.
2. Inspect existing implementation.
3. Understand the current architecture.
4. Avoid duplicating existing functionality.
5. Update documentation when architecture or important decisions change.

---

## Project State

The authoritative project state is stored in:

- `docs/roadmap.md`
- `docs/progress.md`
- `docs/decisions.md`

When starting work on a new session, use these files to understand
the current state of the project.
