import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './common/logger/logger.js';
import routes from './routes/index.js';
import { errorMiddleware } from './common/middleware/error.middleware.js';
import { notFoundMiddleware } from './common/middleware/notFound.middleware.js';
import { tracingMiddleware } from './common/middleware/tracing.middleware.js';

const app = express();

// Trace all incoming requests first
app.use(tracingMiddleware);

// Standard middlewares
app.use(helmet());
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
