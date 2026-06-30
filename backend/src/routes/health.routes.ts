import { Router, Request, Response } from 'express';

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
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
