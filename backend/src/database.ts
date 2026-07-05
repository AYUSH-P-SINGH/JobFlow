import prisma from './prisma.js';
import { logger } from './common/logger/logger.js';

export async function connectDatabase(): Promise<void> {
  try {
    logger.info('Attempting to connect to PostgreSQL database via Prisma...');
    await prisma.$connect();
    logger.info('Successfully connected to the database.');
  } catch (error) {
    logger.error('Failed to connect to the database:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    logger.info('Disconnecting Prisma Client...');
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected.');
  } catch (error) {
    logger.error('Error during database disconnection:', error);
  }
}
