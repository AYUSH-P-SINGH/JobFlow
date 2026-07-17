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
}

export const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_jobflow_development',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || '',
  databaseUrl: process.env.DATABASE_URL || '',
};

// Simple configuration validation
const requiredEnv: (keyof Config)[] = ['jwtSecret', 'databaseUrl'];
for (const env of requiredEnv) {
  if (!config[env]) {
    throw new Error(`Environment variable validation failed: Missing ${env}`);
  }
}
