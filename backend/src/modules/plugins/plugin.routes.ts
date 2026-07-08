import { Router } from 'express';
import { PluginManager } from './plugin.manager.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Protect all plugin queries
router.use(authMiddleware);

router.get('/', (req, res) => {
  const plugins = PluginManager.getPlugins().map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
  res.status(200).json({
    data: plugins,
  });
});

export default router;
