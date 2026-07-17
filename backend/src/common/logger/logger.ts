import winston from 'winston';
import Transport from 'winston-transport';
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
    
    const metaParts: string[] = [];
    if (info.requestId) metaParts.push(`RID: ${info.requestId}`);
    if (info.workflowId) metaParts.push(`WFID: ${info.workflowId}`);
    if (info.workerId) metaParts.push(`WKID: ${info.workerId}`);
    if (info.jobId) metaParts.push(`JID: ${info.jobId}`);
    if (info.executionTime !== undefined) metaParts.push(`Duration: ${info.executionTime}ms`);
    const metaPrefix = metaParts.length > 0 ? ` [${metaParts.join(', ')}]` : '';

    return `[${info.timestamp}] [${info.level}]${cidPrefix}${metaPrefix}: ${info.message}`;
  })
);

export class LokiTransport extends Transport {
  private lokiUrl: string;

  constructor(opts?: any) {
    super(opts);
    this.lokiUrl = process.env.LOKI_URL || 'http://localhost:3100/loki/api/v1/push';
  }

  log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const correlationId = getCorrelationId();
    const message = info.message;
    const level = info.level;
    const timestampNs = String(Date.now() * 1000000);

    const metaParts: string[] = [];
    if (info.requestId) metaParts.push(`RID: ${info.requestId}`);
    if (info.workflowId) metaParts.push(`WFID: ${info.workflowId}`);
    if (info.workerId) metaParts.push(`WKID: ${info.workerId}`);
    if (info.jobId) metaParts.push(`JID: ${info.jobId}`);
    if (info.executionTime !== undefined) metaParts.push(`Duration: ${info.executionTime}ms`);
    const metaPrefix = metaParts.length > 0 ? ` [${metaParts.join(', ')}]` : '';

    const logEntry = `[${level.toUpperCase()}]` + (correlationId ? ` [CID: ${correlationId}]` : '') + metaPrefix + `: ${message}`;

    const payload = {
      streams: [
        {
          stream: {
            job: process.env.OTEL_SERVICE_NAME || 'jobflow-backend',
            level: level,
          },
          values: [
            [timestampNs, logEntry]
          ]
        }
      ]
    };

    import('http').then((http) => {
      try {
        const url = new URL(this.lokiUrl);
        const dataStr = JSON.stringify(payload);

        const options = {
          hostname: url.hostname,
          port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataStr)
          }
        };

        const req = http.request(options);
        req.on('error', () => {
          // Suppress errors during offline local run
        });
        req.write(dataStr);
        req.end();
      } catch (err) {
        // URL parsing errors
      }
    }).catch(() => {
      // Dynamic import errors
    });

    callback();
  }
}

const transports: any[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'development'
      ? logFormat
      : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
  })
];

if (process.env.NODE_ENV !== 'test') {
  transports.push(new LokiTransport());
}

export const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  levels,
  transports,
});
