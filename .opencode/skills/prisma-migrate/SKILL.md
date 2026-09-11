---
name: prisma-migrate
description: Create and run Prisma database migrations
metadata:
  stack: prisma
  project: ai-customer-support
---

## What I do

- Generate Prisma migrations from schema changes
- Apply pending migrations to the database
- Reset the database when needed (dev only)
- Show migration status

## When to use me

Use this when the user wants to:
- Create a new migration after modifying `schema.prisma`
- Apply migrations to the local database
- Check migration status
- Reset dev database

## Commands

```bash
# Generate migration from schema changes
npx prisma migrate dev --name <migration_name>

# Apply migrations (production)
npx prisma migrate deploy

# Reset dev database
npx prisma migrate reset

# Check migration status
npx prisma migrate status

# Regenerate Prisma Client
npx prisma generate
```

## Gotchas

- Always run `npx prisma generate` after schema changes
- `migrate reset` is destructive — dev only
- `postinstall` runs `prisma skills sync` which may fail without a database
