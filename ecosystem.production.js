// PM2 Ecosystem Configuration for Arena Event - Production with Clustering
module.exports = {
  apps: [
    {
      name: 'arena-api',
      cwd: './simple-api',
      script: 'index.js',
      instances: 2, // Run 2 instances for load balancing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      max_memory_restart: '500M',
      error_file: '/root/.pm2/logs/arena-api-error.log',
      out_file: '/root/.pm2/logs/arena-api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Performance monitoring
      instance_var: 'INSTANCE_ID'
    },
    {
      name: 'arena-admin',
      cwd: './apps/web-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_memory_restart: '400M',
      error_file: '/root/.pm2/logs/arena-admin-error.log',
      out_file: '/root/.pm2/logs/arena-admin-out.log',
      merge_logs: true,
      autorestart: true
    },
    {
      name: 'arena-studio',
      cwd: './apps/web-studio',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      max_memory_restart: '400M',
      error_file: '/root/.pm2/logs/arena-studio-error.log',
      out_file: '/root/.pm2/logs/arena-studio-out.log',
      merge_logs: true,
      autorestart: true
    },
    {
      name: 'arena-player',
      cwd: './apps/web-player',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      max_memory_restart: '400M',
      error_file: '/root/.pm2/logs/arena-player-error.log',
      out_file: '/root/.pm2/logs/arena-player-out.log',
      merge_logs: true,
      autorestart: true
    },
    {
      name: 'arena-screen',
      cwd: './apps/web-screen',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3004',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      },
      max_memory_restart: '400M',
      error_file: '/root/.pm2/logs/arena-screen-error.log',
      out_file: '/root/.pm2/logs/arena-screen-out.log',
      merge_logs: true,
      autorestart: true
    }
  ]
};
