import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { redisConnection } from '../config/redis.js';

const router = Router();

// GET /
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Welcome to the JobFlow API',
    version: '1.0.0',
  });
});

// GET /health (Liveness Probe - lightweight check)
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// GET /live (Liveness Probe - lightweight check for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// GET /ready (Readiness Probe - checks dependencies)
router.get('/ready', async (req: Request, res: Response) => {
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
  });
});

// GET /startup (Startup Probe - checks initial bootstrap)
router.get('/startup', async (req: Request, res: Response) => {
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
    database: dbStatus,
    redis: redisStatus,
  });
});

export default router;
