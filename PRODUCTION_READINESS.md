# Production Readiness Guide

## Critical Fixes Applied ✅

### 1. Buzzer Race Condition (FIXED)
**Problem**: Multiple teams buzzing simultaneously could get the same rank.
**Solution**: Implemented Prisma transaction for atomic count+create operations.
**File**: `apps/api/src/game/game.service.ts`

### 2. Hardcoded IPs (FIXED)
**Problem**: IPs hardcoded in frontend code (not portable, security risk).
**Solution**: Replaced all hardcoded IPs with environment variables.
**Files**: All frontend apps now use `.env` configuration.

### 3. CORS Security (FIXED)
**Problem**: CORS open to `*` (any origin could connect).
**Solution**:
- **Production**: Use `ALLOWED_ORIGINS` environment variable (comma-separated)
- **Development**: Allow localhost/127.0.0.1 on any port
**File**: `apps/api/src/realtime/game.gateway.ts`

### 4. Health Check Endpoints (ADDED)
**Endpoints**:
- `GET /health` - Full health check (database, memory, disk)
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

Perfect for Kubernetes/Docker monitoring!

## Environment Variables Required

### API (`apps/api/.env`)
```env
# Required in production
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://studio.yourdomain.com,https://player.yourdomain.com

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/arena_event"

# JWT
JWT_SECRET=your-very-secret-key-change-this
```

### All Frontends (.env.local or .env)
```env
# Required for all apps (Admin, Studio, Player, Screen)
NEXT_PUBLIC_API_URL=http://localhost:3001

# Admin/Studio also need (for quick links)
NEXT_PUBLIC_STUDIO_URL=http://localhost:3002
NEXT_PUBLIC_PLAYER_URL=http://localhost:3003
NEXT_PUBLIC_SCREEN_URL=http://localhost:3004
NEXT_PUBLIC_ADMIN_URL=http://localhost:3000
```

## Deployment Checklist

### Before Deploying to Production:

- [ ] Set `NODE_ENV=production` on API server
- [ ] Configure `ALLOWED_ORIGINS` with your actual domains
- [ ] Set `NEXT_PUBLIC_API_URL` for all frontends
- [ ] Use strong `JWT_SECRET` (minimum 32 characters)
- [ ] Set up database connection with SSL
- [ ] Configure health check monitoring
- [ ] Set up rate limiting (recommended: implement next)
- [ ] Run security audit: `npm audit`

### Remaining Improvements (Not Critical):

1. **RoomsService to Redis** - For horizontal scaling
2. **Rate Limiting** - Prevent abuse (buzzer spam, etc.)
3. **Tests** - Unit & integration tests
4. **Structured Logging** - Winston or Pino
5. **API Documentation** - Swagger/OpenAPI

## Testing Health Checks

```bash
# Basic health
curl http://localhost:3001/health

# Readiness (for load balancer)
curl http://localhost:3001/health/ready

# Liveness (for Kubernetes)
curl http://localhost:3001/health/live
```

## Quick Start (Development)

1. Copy environment files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web-admin/.env.example apps/web-admin/.env.local
cp apps/web-studio/.env.example apps/web-studio/.env.local
cp apps/web-player/.env.example apps/web-player/.env.local
cp apps/web-screen/.env.example apps/web-screen/.env.local
```

2. Start all services:
```bash
npm run dev
```

## Production URLs (Example)

```env
# API
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Frontends
NEXT_PUBLIC_ADMIN_URL=https://admin.yourdomain.com
NEXT_PUBLIC_STUDIO_URL=https://studio.yourdomain.com
NEXT_PUBLIC_PLAYER_URL=https://play.yourdomain.com
NEXT_PUBLIC_SCREEN_URL=https://screen.yourdomain.com

# API CORS
ALLOWED_ORIGINS=https://admin.yourdomain.com,https://studio.yourdomain.com,https://play.yourdomain.com,https://screen.yourdomain.com
```

## Security Notes

- ✅ No more hardcoded IPs
- ✅ CORS restricted in production
- ✅ Race condition fixed (fair buzzer ranking)
- ⚠️ Add rate limiting before production
- ⚠️ Implement Redis for scaling (optional)
- ⚠️ Set up HTTPS/TLS in production
