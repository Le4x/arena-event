// Redis Configuration for Arena Event API
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

// Redis client for caching and general use
export async function createRedisClient() {
  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB || '0'),
  });

  client.on('error', (err) => console.error('❌ Redis Client Error:', err));
  client.on('connect', () => console.log('✅ Redis Client Connected'));
  client.on('ready', () => console.log('✅ Redis Client Ready'));

  await client.connect();
  return client;
}

// Setup Socket.io Redis Adapter for multi-instance support
export async function setupSocketIORedisAdapter(io) {
  const pubClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB || '0'),
  });

  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));

  console.log('✅ Socket.IO Redis Adapter configured');
  console.log('   - Multiple API instances can now share WebSocket state');
  console.log('   - Pub/Sub enabled for cross-instance communication');

  return { pubClient, subClient };
}

// Redis Cache Helper Functions
export class RedisCache {
  constructor(client) {
    this.client = client;
  }

  // Cache session data
  async cacheSession(sessionId, data, ttl = 3600) {
    const key = `session:${sessionId}`;
    await this.client.setEx(key, ttl, JSON.stringify(data));
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    await this.client.del(key);
  }

  // Cache leaderboard data
  async cacheLeaderboard(sessionId, leaderboard, ttl = 30) {
    const key = `leaderboard:${sessionId}`;
    await this.client.setEx(key, ttl, JSON.stringify(leaderboard));
  }

  async getLeaderboard(sessionId) {
    const key = `leaderboard:${sessionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Cache active sessions list
  async cacheActiveSessions(sessions, ttl = 60) {
    const key = 'sessions:active';
    await this.client.setEx(key, ttl, JSON.stringify(sessions));
  }

  async getActiveSessions() {
    const key = 'sessions:active';
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Invalidate all cache
  async flushAll() {
    await this.client.flushDb();
    console.log('✅ Redis cache flushed');
  }
}

export default {
  createRedisClient,
  setupSocketIORedisAdapter,
  RedisCache,
};
