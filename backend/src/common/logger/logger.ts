import winston from 'winston';
import { config } from '../../config/env.js';
import { getCorrelationId } from '../tracing/context.js';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const correlationId = getCorrelationId();
    const cidPrefix = correlationId ? ` [CID: ${correlationId}]` : '';
    return `[${info.timestamp}] [${info.level}]${cidPrefix}: ${info.message}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: config.nodeEnv === 'development'
      ? logFormat
      : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
  })
];

export const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  levels,
  transports,
});
