# --- Stage 1: builder ---
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first (better cache reuse).
# --legacy-peer-deps: @nestjs/throttler@6.5.0 declares peer Support only up to
# @nestjs/common@^11, but the lockfile pins @nestjs/common@12.0.1. The lockfile
# IS the source of truth; this flag installs its exact tree without re-checking
# the stale peer range.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source, Nest config, and Prisma config (Prisma 7 config file)
COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client + build Nest.
# prisma.config.ts eagerly reads DATABASE_URL — it is only used to load the
# config; `prisma generate` never connects to a database, so a placeholder is
# safe here. The runtime stage (and container) supplies the real one.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
RUN npx prisma generate
RUN npm run build

# --- Stage 2: runtime ---
FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Production dependencies only (no devDependencies in the image)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --legacy-peer-deps

# prisma CLI + tsx are devDependencies in package.json but are required at
# container startup for `prisma migrate deploy` and `prisma db seed`
# (seed script is `npx tsx prisma/seed.ts` per prisma.config.ts).
# They are installed into a separate tool tree: executing `npm install` again
# inside the app directory sees their exact versions already in the lockfile
# and skips them ("up to date"), so a standalone package.json is used instead.
# Versions are pinned to match what the builder used.
RUN mkdir -p /tools && cd /tools \
    && npm init -y >/dev/null \
    && npm install --no-save --legacy-peer-deps prisma@7.10.0 tsx@4.23.13

# Expose the tool bins through the app's local node_modules/.bin so that
# `npx prisma` and the seed command `npx tsx prisma/seed.ts` resolve to the
# locked versions instead of downloading from the registry.
RUN for f in /tools/node_modules/.bin/*; do ln -sf "$f" /app/node_modules/.bin/; done

ENV PATH="/tools/node_modules/.bin:${PATH}" NODE_PATH=/tools/node_modules

# Copy built app, generated Prisma client, migrations/seed, and config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

# Migrations and seed are idempotent — safe to run on every container start.
# `migrate deploy` only applies new migrations; seeding uses upserts.
# prisma/tsx resolve from /tools (see PATH above); npx finds them there.
CMD ["sh", "-c", "prisma migrate deploy && prisma db seed && node dist/main.js"]