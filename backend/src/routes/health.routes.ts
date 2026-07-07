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

// GET /health
router.get('/health', async (req: Request, res: Response) => {
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

  const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

  res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    server: 'healthy',
    database: dbStatus,
    redis: redisStatus,
  });
});

export default router;
