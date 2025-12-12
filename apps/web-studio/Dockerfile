# Next.js Web Studio Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/web-studio/package*.json ./apps/web-studio/

RUN npm ci

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_PLAYER_URL
ARG NEXT_PUBLIC_SCREEN_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_PLAYER_URL=$NEXT_PUBLIC_PLAYER_URL
ENV NEXT_PUBLIC_SCREEN_URL=$NEXT_PUBLIC_SCREEN_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-studio/node_modules ./apps/web-studio/node_modules

COPY apps/web-studio ./apps/web-studio
COPY package*.json ./
COPY turbo.json ./

RUN cd apps/web-studio && npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web-studio/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-studio/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-studio/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
