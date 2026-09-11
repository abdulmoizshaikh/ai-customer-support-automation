# AI Support Automation — Frontend

React dashboard for the local AI customer support automation platform.

## Purpose

A Vite + React + TypeScript dashboard that lets customers submit support
tickets, agents manage the approval queue, and admins inspect the **AI
execution trace** — the per-ticket audit timeline showing how the backend
classified, researched, decided, and acted on each request.

## Prerequisites

- The backend must be running on `http://localhost:3000`
  (`cd ../backend && npm run start:dev`)
- The PostgreSQL database must be up (`docker compose up -d` at the project root)

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # tsc -b && vite build  → dist/
npm run preview  # serve the production build
npm run lint     # tsc --noEmit
```

## Screens

| Route          | Screen                                        | Access |
| -------------- | --------------------------------------------- | ------ |
| `/`            | Submit a support ticket (with demo messages)  | Public |
| `/login`       | Sign in (agent / admin)                       | Public |
| `/dashboard`   | Ticket list with status filters, auto-refresh | JWT    |
| `/tickets/:id` | Ticket detail + AI execution trace timeline   | JWT    |
| `/approvals`   | Pending/approved/rejected approval queue      | JWT    |
| `/analytics`   | Stats: automation rate, decisions, providers  | JWT    |

Seeded accounts: `agent@example.com / Agent123!`, `admin@example.com / Admin123!`.

## Architecture notes

- **API proxy**: `vite.config.ts` proxies `/api/*` to `http://localhost:3000`
  (rewriting `/api` away), so the browser talks to a same-origin address and
  no CORS configuration is needed.
- **Auth**: JWT access token and user profile are stored in `sessionStorage`
  (not `localStorage`) — the session ends when the tab closes. The fetch
  wrapper in `src/lib/api.ts` attaches the `Authorization` header and clears
  the session on 401.
- **Server state**: managed with TanStack Query (`@tanstack/react-query`);
  pages auto-refresh (tickets/10s, analytics/15s). No client state library.
- **Types**: `src/lib/types.ts` mirrors the backend response shapes exactly
  (verified against the NestJS controllers and Prisma schema).
