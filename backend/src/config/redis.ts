import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import { config } from './env.js';
import { logger } from '../common/logger/logger.js';

/**
 * Creates a new IORedis connection instance.
 * Use this factory for any component that needs its own Redis connection
 * (e.g., BullMQ Queue, Worker, QueueEvents each need separate connections).
 */
export function createRedisConnection(label = 'default'): Redis {
  if (config.nodeEnv === 'test' || process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'))) {
    // Return a mocked Redis client in test environment to avoid offline errors and hanging tests
    const mockStore = new Map<string, string>();
    const mockClient = new EventEmitter();
    Object.assign(mockClient, {
      quit: () => Promise.resolve(),
      disconnect: () => { },
      ping: () => Promise.resolve('PONG'),
      status: 'ready',
      get: (key: string) => Promise.resolve(mockStore.get(key) || null),
      set: (key: string, value: string) => {
        mockStore.set(key, value);
        return Promise.resolve('OK');
      },
      incr: (key: string) => {
        const val = parseInt(mockStore.get(key) || '0', 10) + 1;
        mockStore.set(key, String(val));
        return Promise.resolve(val);
      },
      expire: () => Promise.resolve(1),
      eval: () => Promise.resolve(1),
      del: (key: string) => {
        const existed = mockStore.has(key);
        mockStore.delete(key);
        return Promise.resolve(existed ? 1 : 0);
      }
    });
    return mockClient as any;
  }

  const connection = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy(times: number) {
      if (times > 5) {
        logger.error(`Redis [${label}]: Max retry attempts (5) reached. Stopping reconnection.`);
        return null;
      }
      const delay = Math.min(times * 500, 5000);
      logger.warn(`Redis [${label}]: Retry attempt ${times}, next in ${delay}ms`);
      return delay;
    },
    enableReadyCheck: true,
    lazyConnect: false,
  });

  connection.on('connect', () => {
    logger.info(`Redis [${label}]: Connected to ${config.redisHost}:${config.redisPort}`);
  });

  connection.on('ready', () => {
    logger.info(`Redis [${label}]: Ready`);
  });

  connection.on('error', (err: Error) => {
    logger.error(`Redis [${label}]: Connection error — ${err.message}`);
  });

  connection.on('close', () => {
    logger.warn(`Redis [${label}]: Connection closed`);
  });

  return connection;
}

/**
 * Default shared Redis connection singleton.
 * Used for health checks, general Redis operations, etc.
 * BullMQ queues/workers should use createRedisConnection() for their own connections.
 */
export const redisConnection = createRedisConnection('main');
