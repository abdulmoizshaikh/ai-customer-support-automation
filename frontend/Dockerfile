# --- Stage 1: builder ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build for production. The frontend talks to /api/* which nginx proxies to the
# backend — Vite's dev proxy is not used in production.
RUN npm run build

# --- Stage 2: runtime (nginx) ---
FROM nginx:alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]