# Next.js Web Screen Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/web-screen/package*.json ./apps/web-screen/

RUN npm ci

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_PLAYER_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_PLAYER_URL=$NEXT_PUBLIC_PLAYER_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-screen/node_modules ./apps/web-screen/node_modules

COPY apps/web-screen ./apps/web-screen
COPY package*.json ./
COPY turbo.json ./

RUN cd apps/web-screen && npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web-screen/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-screen/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-screen/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
