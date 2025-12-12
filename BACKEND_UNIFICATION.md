# Backend Unification Strategy

## Current State Analysis

Arena Event currently has **two backend implementations**:

### 1. `simple-api` (Express.js) - **ACTIVE in Production**
- **Location**: `/simple-api/index.js`
- **Port**: 3001
- **Status**: Currently used in production (configured in `ecosystem.config.js`)
- **Features**:
  - Server-authoritative timer with 500ms sync (optimized from 100ms)
  - Buzzer lock manager with race-condition protection
  - Finale mode with jokers (DOUBLE, TIME_PLUS, FIFTY_FIFTY, SHIELD)
  - Rate limiting on buzzer presses
  - Redis adapter for horizontal scaling (when REDIS_URL is set)
  - Session cleanup mechanism
  - Monitoring metrics (/health, /metrics endpoints)

### 2. `apps/api` (NestJS) - **NOT ACTIVE**
- **Location**: `/apps/api/`
- **Port**: 3001 (same as simple-api, conflict)
- **Status**: Not currently used in production
- **Features**:
  - Well-structured modular architecture
  - JWT authentication with roles
  - Prisma ORM integration
  - WebSocket Gateway with authentication

## Recommendation: Keep `simple-api` as Primary Backend

After reviewing both implementations, we recommend **keeping `simple-api` as the primary backend** for the following reasons:

### Reasons to Keep simple-api

1. **Production Proven**: Already deployed and running events successfully
2. **Real-time Optimized**: Contains battle-tested timer sync and buzzer logic
3. **Feature Complete**: Has all required features including finale mode with jokers
4. **Recent Optimizations**: Now includes Redis adapter, CORS security, upload validation, session cleanup, and monitoring
5. **Lower Complexity**: Single-file architecture is easier to debug during events

### What to Do with NestJS Backend

The NestJS backend (`apps/api`) should be:

1. **Archived**: Keep for reference but don't deploy
2. **Documentation**: Document its architecture for potential future migration
3. **Type Definitions**: Continue using shared types from `packages/shared`

## Migration Path (If Desired)

If you want to eventually migrate to NestJS for better maintainability, here's the recommended path:

### Phase 1: Feature Parity (2-3 weeks)
- [ ] Port timer sync logic (500ms with interpolation)
- [ ] Port buzzer lock manager with queue tracking
- [ ] Port finale mode with all jokers
- [ ] Add Redis adapter for Socket.IO
- [ ] Add session cleanup mechanism
- [ ] Add monitoring endpoints

### Phase 2: Testing (1 week)
- [ ] Run both backends in parallel in staging
- [ ] Load test with simulated 100+ clients
- [ ] Verify buzzer fairness under load
- [ ] Test timer synchronization accuracy

### Phase 3: Switchover (1 day)
- [ ] Update ecosystem.config.js to use apps/api
- [ ] Deploy during low-traffic period
- [ ] Monitor metrics closely for 24 hours

## Current Optimizations Applied

The following optimizations from the audit have been implemented in `simple-api`:

| Optimization | Status | Details |
|-------------|--------|---------|
| Timer sync (100ms -> 500ms) | DONE | Reduces network load by 80% |
| Redis Adapter | DONE | Enables horizontal scaling |
| CORS Security | DONE | Environment-based allowed origins |
| Upload Validation | DONE | MIME types and file size limits |
| Session Cleanup | DONE | 5-minute interval, 1-hour timeout |
| Monitoring Metrics | DONE | /health and /metrics endpoints |

## Environment Variables Required

```bash
# For Redis adapter (horizontal scaling)
REDIS_URL=redis://localhost:6379

# For CORS in production
CORS_ORIGINS=https://admin.arena-event.fr,https://player.arena-event.fr,https://screen.arena-event.fr,https://studio.arena-event.fr

# For secure uploads
SIMPLE_API_UPLOAD_TOKEN=your-secure-token

# Standard configuration
JWT_SECRET=your-jwt-secret
NODE_ENV=production
```

## Monitoring in Production

After deployment, monitor:

1. **Health Check**: `GET /health`
   - Should return `{ status: 'healthy', uptime: ..., timestamp: ... }`

2. **Metrics**: `GET /metrics`
   - Watch `websocket.activeConnections` for client count
   - Monitor `latency.avgMs` for response times
   - Check `memory.heapUsedMB` for memory leaks
   - Track `sessions.activeTimers` for game state

## Conclusion

The `simple-api` backend is now production-ready for 80-100 concurrent clients with:
- Optimized timer synchronization
- Redis support for horizontal scaling
- Proper CORS security
- Upload validation
- Automatic session cleanup
- Real-time monitoring

The NestJS backend can be considered for a future v2.0 release when there's time for proper migration and testing.
