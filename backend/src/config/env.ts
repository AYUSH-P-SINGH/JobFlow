import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  databaseUrl: string;
  corsOrigin: string;
  logLevel: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || '',
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Required environment variable validation
const requiredEnv: (keyof Config)[] = ['jwtSecret', 'databaseUrl'];
for (const env of requiredEnv) {
  if (!config[env]) {
    throw new Error(`Environment variable validation failed: Missing ${env}. Set ${env.replace(/([A-Z])/g, '_$1').toUpperCase()} in your .env file.`);
  }
}

// Production-mode safety guard: block startup with known placeholder secrets
const INSECURE_SECRETS = [
  'your_jwt_secret_key_here',
  'super_secret_jwt_key_jobflow_development',
  'super_secret_jwt_key_jobflow_production',
  'changeme',
  'secret',
];

if (config.nodeEnv === 'production' && INSECURE_SECRETS.includes(config.jwtSecret)) {
  throw new Error(
    'FATAL: JWT_SECRET is set to an insecure placeholder value. ' +
    'Generate a strong secret (e.g. `openssl rand -base64 64`) before deploying to production.'
  );
}
