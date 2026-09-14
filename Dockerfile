# syntax=docker/dockerfile:1

# ==============================================================================
# Doctor Ali — Qabulxona
#
# Three stages, because the thing that ends up on the clinic's server should
# contain the app and nothing else: no sources, no dev dependencies, no build
# cache. Next's `output: "standalone"` bundles the server and only the modules
# it actually imports, which is what makes the final image ~180 MB instead of
# ~1.2 GB.
#
#   docker build -t doctor-ali-qabulxona --build-arg APP_SERVER=prod .
#   docker run -p 3000:3000 -e APP_SERVER=prod doctor-ali-qabulxona
#
# Odatda qo'lda emas — `./deploy/deploy.sh prod`.
# ==============================================================================

# --- 1. Dependencies ----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is rebuilt when the dependencies change and
# not when a component does.
COPY package.json package-lock.json* ./
RUN npm ci

# --- 2. Build -----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined at build time — they are not read from the
# container's environment at runtime. That is Next's model.
#
# Which backend this build belongs to is ONE argument: `next.config.ts` reads
# `config/servers.mjs` and derives the media origin and the site URL from it.
# The rest are overrides that a normal deploy never passes.
ARG APP_SERVER=prod
ARG NEXT_PUBLIC_API_BASE_URL=/api/reception/
ARG NEXT_PUBLIC_PRINT_AGENT_URL
ARG NEXT_PUBLIC_API_LOGGING=false
ENV APP_SERVER=$APP_SERVER \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_PRINT_AGENT_URL=$NEXT_PUBLIC_PRINT_AGENT_URL \
    NEXT_PUBLIC_API_LOGGING=$NEXT_PUBLIC_API_LOGGING \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- 3. Runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

# Image o'zi qaysi serverga tegishli ekanini biladi, shuning uchun `docker run`
# ga qo'shimcha bayroq kerak emas. Runtime'da buni faqat proksi zaxirasi o'qiydi.
ARG APP_SERVER=prod
ENV NODE_ENV=production \
    APP_SERVER=$APP_SERVER \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# A non-root user: the panel needs nothing from the filesystem it doesn't ship.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# The standalone bundle already contains a minimal node_modules and server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The image optimiser's cache. Created here, owned by the runtime user, so the
# named volume mounted over it (see docker-compose.yml) inherits that
# ownership — otherwise a root-owned mount would silently disable the cache and
# every restart would re-shrink every product photo from its 3 MB original.
RUN mkdir -p .next/cache/images && chown -R nextjs:nodejs .next/cache

USER nextjs
EXPOSE 3000

# Compose/Swarm restarts the container when this stops answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
