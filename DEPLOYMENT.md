# 🚀 Deployment Guide - Arena Event

This guide covers deployment strategies for Arena Event platform.

---

## 📦 Production Build

### 1. Build All Applications

```bash
# Install dependencies
npm install

# Build all apps
npm run build
```

This creates optimized production builds in:
- `apps/api/dist/` - Backend
- `apps/web-admin/.next/` - Admin frontend
- `apps/web-studio/.next/` - Studio frontend
- `apps/web-player/.next/` - Player frontend
- `apps/web-screen/.next/` - Screen frontend

---

## 🐳 Docker Deployment

### Backend (API)

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/

RUN npm install

COPY apps/api/ ./apps/api/
COPY turbo.json ./

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/apps/api/prisma ./prisma

RUN npm install --production

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
```

### Frontend (Next.js)

Create `apps/web-admin/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/web-admin/package*.json ./apps/web-admin/
COPY packages/ ./packages/

RUN npm install

COPY apps/web-admin/ ./apps/web-admin/
COPY turbo.json ./

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/apps/web-admin/.next ./.next
COPY --from=builder /app/apps/web-admin/public ./public
COPY --from=builder /app/apps/web-admin/package*.json ./

RUN npm install --production

EXPOSE 3000

CMD ["npm", "start"]
```

Repeat for other frontends (web-studio, web-player, web-screen) with appropriate ports.

---

## ☁️ Cloud Platforms

### Vercel (Recommended for Frontends)

1. **Connect Repository** to Vercel
2. **Configure Build Settings** for each frontend:
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
   - **Root Directory**: `apps/web-admin` (or web-studio, etc.)

3. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

### Railway / Render (For Backend)

1. **Create New Service**
2. **Connect to GitHub**
3. **Set Root Directory**: `apps/api`
4. **Build Command**: `npm install && npm run build && npx prisma migrate deploy`
5. **Start Command**: `npm run start:prod`

6. **Environment Variables**:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-production-secret
   REDIS_HOST=your-redis-host
   NODE_ENV=production
   ```

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create arena-event-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Add Redis
heroku addons:create heroku-redis:hobby-dev

# Deploy
git subtree push --prefix apps/api heroku main
```

---

## 🗄️ Database

### PostgreSQL

**Production Options:**
- **Managed Services**: AWS RDS, Google Cloud SQL, DigitalOcean Managed Database
- **Serverless**: Neon, Supabase, PlanetScale

**Migration Strategy:**

```bash
# Production migrations
cd apps/api
npx prisma migrate deploy

# Seed production data (optional)
npm run db:seed
```

### Redis

**Production Options:**
- **Managed Services**: AWS ElastiCache, Redis Cloud, Upstash
- **DigitalOcean**: Managed Redis

---

## 🔐 Security Checklist

### Before Deploying

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update `DATABASE_URL` to production database
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Enable logging and monitoring
- [ ] Set up backup strategy for database
- [ ] Review and update `.gitignore`

---

## 📊 Monitoring

### Recommended Tools

- **Application Monitoring**: Sentry, Datadog, New Relic
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Log Management**: Logtail, Papertrail
- **Performance**: Lighthouse, WebPageTest

### Health Check Endpoints

Create health check routes:

```typescript
// apps/api/src/app.controller.ts
@Get('/health')
health() {
  return { status: 'ok', timestamp: new Date() };
}
```

---

## 🌐 CDN & Assets

### Static Assets

- Use Cloudflare, AWS CloudFront, or Vercel Edge Network
- Optimize images with Next.js Image Optimization
- Enable gzip/brotli compression

---

## 🔄 CI/CD

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: npm test
      # Add deployment steps
```

---

## 📈 Scaling Considerations

### Horizontal Scaling

- Use load balancer (Nginx, AWS ELB)
- Deploy multiple API instances
- Use Redis for session sharing
- Implement WebSocket sticky sessions

### Database

- Enable connection pooling (PgBouncer)
- Add read replicas for queries
- Implement caching layer (Redis)

### WebSocket

- Use Redis adapter for Socket.IO multi-instance
- Configure sticky sessions on load balancer

---

## 🆘 Troubleshooting

### Common Issues

**Database Connection Fails**
- Check `DATABASE_URL` format
- Verify firewall allows connections
- Check database is running

**WebSocket Not Connecting**
- Ensure WebSocket protocol is allowed
- Check CORS configuration
- Verify port is open

**Build Fails**
- Clear node_modules and reinstall
- Check Node.js version
- Verify all environment variables

---

## 📞 Support

For deployment assistance, consult the main README.md or open an issue.

---

**Good luck with your deployment! 🚀**
