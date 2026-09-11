# Project Progress

## Current Stage

**Phases 1–3 complete; Phases 4–9 pending**

### Completed

- [x] Repository created
- [x] Backend scaffolded — NestJS 12, TypeScript 6, ESM
- [x] Database — PostgreSQL 16 via Docker Compose (`pgvector/pgvector:pg16`, container `ai-support-postgres`, volume `backend_postgres_data`)
- [x] Prisma 7 stable + driver adapter (`@prisma/adapter-pg` / `PrismaPg`), classic `schema.prisma`
- [x] 10-table schema + migrations applied (`init`, `knowledge_filename_unique`)
- [x] Seed data loaded — 3 customers, 5 orders (123/124/125, 456, 789), 2 staff users (admin + agent), 3 knowledge docs
- [x] `CustomersModule`, `OrdersModule`, `RefundsModule`, `UsersModule`, `AuthModule`, `PrismaModule` all wired into `AppModule`
- [x] `npm run build` passes (exit 0); unit tests pass (Vitest)
- [x] End-to-end verification of `/orders/:id` (literal curl output):
  - `GET /orders/123` → `200` body `amount: "750"`
  - `GET /orders/789` → `200` body `amount: "2500"`
  - `GET /orders/999` → `404` body `{"message":"Order 999 not found","error":"Not Found","statusCode":404}`
- [x] `.env` + `.env.example` with DATABASE_URL, JWT secrets/TTLs, `AI_PROVIDER=mock`, business-rule limits
- [x] Linting (oxlint), formatting (Prettier), Observability (NestJS Observe, placeholder credentials)

### Pending / Phase 3 follow-up

- [ ] Register `JwtAuthGuard` globally via `APP_GUARD` in `AuthModule`, with a `@Public()` decorator opt-out for `/auth/login` and `/auth/register`.
- [ ] Register `RolesGuard` globally after `JwtAuthGuard` so `@Roles(...)` metadata is actually enforced.
- [ ] Verify `GET /orders/:id` returns 401 without a JWT once guards are live, then re-verify with a JWT from `POST /auth/login`.

### Key technical decisions

- Prisma **7 stable** with the driver adapter (not Prisma 8 RC contract-based setup).
- Docker `pgvector/pgvector:pg16`, database user/db both `ai_support` (matching `backend/.env`).
- `docker-compose.yml` at the **project root** (`ai-customer-support/docker-compose.yml`) — validate with `docker compose config`; the running seeded container was **not** recreated.
- Enums are type-only unions in the generated client, so `@IsEnum(Role)` validates against the runtime const while the type side uses string literals (e.g. `Exclude<Role, 'CUSTOMER'>`).
- Prisma error classes import from `@prisma/client/runtime/client` (the `runtime/library` path does not exist in v7).

## Next Step

Phase 4 — Support tickets & AI classification (wire the local LLM / mock provider and a `Ticket` API on the existing `Ticket` model).
