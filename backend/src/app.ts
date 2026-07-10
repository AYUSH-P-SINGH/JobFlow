import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './common/logger/logger.js';
import routes from './routes/index.js';
import { errorMiddleware } from './common/middleware/error.middleware.js';
import { notFoundMiddleware } from './common/middleware/notFound.middleware.js';
import { tracingMiddleware } from './common/middleware/tracing.middleware.js';
import { MetricsService } from './modules/monitoring/metrics.service.js';
import './modules/plugins/plugin.manager.js';

const app = express();

// Trace all incoming requests first
app.use(tracingMiddleware);

// Record API response time latency
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    if (!req.path.includes('/metrics') && !req.path.includes('/admin')) {
      const pathRoute = req.route ? req.route.path : req.path;
      MetricsService.recordHttpDuration(req.method, pathRoute, res.statusCode, durationSeconds);
    }
  });
  next();
});

// Standard middlewares & Strict Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    referrerPolicy: {
      policy: 'no-referrer',
    },
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import { rateLimitMiddleware } from './common/middleware/rateLimit.middleware.js';
app.use(rateLimitMiddleware);

// Integrate Morgan HTTP request logger with our custom Winston logger
const morganFormat = ':remote-addr :method :url :status :res[content-length] - :response-time ms';
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);

// Setup router
app.use(routes);

// 404 Route handler
app.use(notFoundMiddleware);

// Global Error Handler
app.use(errorMiddleware);

export default app;
