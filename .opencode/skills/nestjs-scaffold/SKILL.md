---
name: nestjs-scaffold
description: Generate NestJS modules, controllers, and services using the Nest CLI
metadata:
  framework: nestjs
  project: ai-customer-support
---

## What I do

- Scaffold new NestJS modules with controller and service
- Generate individual controllers, services, gates, decorators
- Follow existing project conventions

## When to use me

Use this when the user wants to:
- Create a new feature module (e.g. tickets, customers, orders)
- Add a controller, service, or other NestJS component
- Scaffold CRUD endpoints for a new resource

## Conventions

- Source root is `src/` (configured in `nest-cli.json`)
- All imports use `.js` extensions (ESM with `moduleResolution: nodenext`)
- Use existing `AppModule` as the root module
- Follow existing code style: single quotes, trailing commas

## Commands

```bash
# Generate a module with controller and service
npx nest g module <name>
npx nest g controller <name>
npx nest g service <name>

# Generate all three at once
npx nest g resource <name>

# Dry run (preview without creating files)
npx nest g module <name> --dry-run
```

## Gotchas

- Nest CLI generates `.ts` files — you may need to add `.js` extensions to imports manually
- Generated files go to `src/` by default
- After scaffolding, register new modules in the parent module's `imports` array
