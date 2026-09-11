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
#   docker build -t doctor-ali-qabulxona \
#     --build-arg NEXT_PUBLIC_MEDIA_ORIGIN=https://my.imorganic.uz .
#   docker run -p 3000:3000 \
#     -e API_PROXY_TARGET=https://my.imorganic.uz doctor-ali-qabulxona
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
# container's environment at runtime, so they must be passed in here. That is
# Next's model.
#
# The backend origin is deliberately NOT one of them: the browser calls
# `/api/reception/` on this container and the server forwards it, reading
# API_PROXY_TARGET at RUNTIME. Switching between test and production is
# therefore an `-e` flag, not a rebuild.
ARG NEXT_PUBLIC_API_BASE_URL=/api/reception/
ARG NEXT_PUBLIC_MEDIA_ORIGIN
ARG NEXT_PUBLIC_PRINT_AGENT_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_LOGGING=false
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_MEDIA_ORIGIN=$NEXT_PUBLIC_MEDIA_ORIGIN \
    NEXT_PUBLIC_PRINT_AGENT_URL=$NEXT_PUBLIC_PRINT_AGENT_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_LOGGING=$NEXT_PUBLIC_API_LOGGING \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- 3. Runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
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
