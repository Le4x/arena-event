/**
 * PM2 Ecosystem Configuration - Arena Event
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    // API Backend (Simple API avec WebSocket)
    {
      name: 'arena-api',
      cwd: './simple-api',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://arena:arena123@localhost:5432/arena_event?schema=public',
        JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
      }
    },

    // Web Admin (Next.js) - Port 3002
    {
      name: 'arena-admin',
      cwd: './apps/web-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },

    // Web Player (Next.js) - Port 3003
    {
      name: 'arena-player',
      cwd: './apps/web-player',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      }
    },

    // Web Screen (Next.js) - Port 3004
    {
      name: 'arena-screen',
      cwd: './apps/web-screen',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3004',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      }
    },

    // Web Studio / Game Master (Next.js) - Port 3005
    {
      name: 'arena-studio',
      cwd: './apps/web-studio',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3005',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      }
    }
  ]
};
