# NestJS API Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for build
RUN apk add --no-cache openssl

# Copy root package files for workspace
COPY package*.json ./
COPY turbo.json ./

# Copy api package files
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install all dependencies
RUN npm ci

# Copy source code
COPY apps/api ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the application
RUN cd apps/api && npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Copy built application
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/apps/api/prisma ./prisma

# Generate Prisma client in production
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/main.js"]
