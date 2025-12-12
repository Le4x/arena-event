# Next.js Web Admin Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web-admin/package*.json ./apps/web-admin/

# Install dependencies
RUN npm ci

FROM base AS builder
WORKDIR /app

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-admin/node_modules ./apps/web-admin/node_modules

# Copy source
COPY apps/web-admin ./apps/web-admin
COPY package*.json ./
COPY turbo.json ./

# Build
RUN cd apps/web-admin && npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/apps/web-admin/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-admin/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
