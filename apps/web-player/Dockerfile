# Next.js Web Player Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/web-player/package*.json ./apps/web-player/

RUN npm ci

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-player/node_modules ./apps/web-player/node_modules

COPY apps/web-player ./apps/web-player
COPY package*.json ./
COPY turbo.json ./

RUN cd apps/web-player && npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web-player/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-player/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-player/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
