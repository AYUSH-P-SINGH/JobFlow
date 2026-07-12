import dotenv from 'dotenv';
// Load environment variables before anything else
dotenv.config();

import './common/tracing/otel.js';
import express from 'express';
import { logger } from './common/logger/logger.js';
import prisma from './prisma.js';
import { redisConnection } from './config/redis.js';
import { WorkerHealthTracker } from './workers/worker.health.js';
import { initializeWorker, shutdownWorker } from './workers/worker.lifecycle.js';
import { MetricsController } from './modules/monitoring/metrics.controller.js';

async function bootstrap() {
  logger.info('Starting JobFlow Background Worker Process...');

  try {
    // Verify Database Connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Worker DB Connection: SUCCESS');

    // Initialize Worker instance & listener
    await initializeWorker();
    logger.info('Worker Lifecycle: READY & LISTENING');

    // Start minimal HTTP health check server for Kubernetes probes
    const workerPort = process.env.WORKER_PORT || '5001';
    const healthApp = express();
    
    // Prometheus metrics scraper
    healthApp.get('/metrics', MetricsController.prometheus);

    // /health (Liveness)
    healthApp.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'alive', 
        workerId: WorkerHealthTracker.getInstance().workerId,
        timestamp: new Date().toISOString()
      });
    });
    
    // /ready (Readiness)
    healthApp.get('/ready', async (req, res) => {
      let dbStatus = 'healthy';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        dbStatus = 'unhealthy';
      }

      let redisStatus = 'healthy';
      try {
        const pong = await redisConnection.ping();
        if (pong !== 'PONG') {
          redisStatus = 'unhealthy';
        }
      } catch (error) {
        redisStatus = 'unhealthy';
      }

      const isReady = dbStatus === 'healthy' && redisStatus === 'healthy';
      res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'not_ready',
        database: dbStatus,
        redis: redisStatus,
        metrics: WorkerHealthTracker.getInstance().getHealthData(),
      });
    });
    
    // /startup (Startup)
    healthApp.get('/startup', async (req, res) => {
      let dbStatus = 'healthy';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        dbStatus = 'unhealthy';
      }

      let redisStatus = 'healthy';
      try {
        const pong = await redisConnection.ping();
        if (pong !== 'PONG') {
          redisStatus = 'unhealthy';
        }
      } catch (error) {
        redisStatus = 'unhealthy';
      }

      const isStarted = dbStatus === 'healthy' && redisStatus === 'healthy';
      res.status(isStarted ? 200 : 500).json({
        status: isStarted ? 'started' : 'failed_to_start',
      });
    });

    const healthServer = healthApp.listen(workerPort, () => {
      logger.info(`Worker Health Server is running on port ${workerPort}`);
    });

    // Register Shutdown hooks
    process.on('SIGINT', async () => {
      logger.info('Worker received SIGINT. Shutting down gracefully...');
      healthServer.close();
      await shutdownWorker();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Worker received SIGTERM. Shutting down gracefully...');
      healthServer.close();
      await shutdownWorker();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Worker failed to bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
