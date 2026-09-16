# syntax=docker/dockerfile:1

# --- deps: full node_modules (native better-sqlite3 build needs python3/make/g++)
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# ponytail: npm install, not npm ci: the macOS-generated lock misses Linux-only optional deps (@emnapi/*). Switch back to npm ci once the lock is regenerated on Linux.
RUN npm install --no-audit --no-fund

# --- build: next build (output: standalone)
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- tools: ingest / batch:faq (tsx + scripts + full node_modules)
# docker compose run --rm tools npm run ingest
FROM deps AS tools
COPY . .
ENV DATABASE_PATH=/data/loila.db
# scripts write to ./data (raw XML cache): point it at the volume
RUN mkdir -p /data && chown node:node /data && ln -s /data /app/data
USER node
VOLUME /data
CMD ["npm", "run", "batch:faq"]

# --- runner: minimal runtime image (default target, keep last)
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/loila.db
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
