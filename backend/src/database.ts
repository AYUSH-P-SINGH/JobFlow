import prisma from './prisma.js';
import { logger } from './common/logger/logger.js';

async function seedDefaultTenant(): Promise<void> {
  try {
    const tenantCount = await prisma.tenant.count();
    if (tenantCount === 0) {
      logger.info('No tenants found in the database. Seeding default tenant...');
      const defaultTenant = await prisma.tenant.create({
        data: {
          id: 'default-tenant-id',
          name: 'Default Organization',
        },
      });

      await prisma.project.create({
        data: {
          id: 'default-project-id',
          name: 'Default Project',
          tenantId: defaultTenant.id,
        },
      });

      const updatedUsers = await prisma.user.updateMany({
        where: { tenantId: null },
        data: { tenantId: defaultTenant.id },
      });
      
      logger.info(`Seeded default tenant. Associated ${updatedUsers.count} existing users.`);
    }
  } catch (error) {
    logger.error('Failed to seed default tenant:', error);
  }
}

export async function connectDatabase(): Promise<void> {
  try {
    logger.info('Attempting to connect to PostgreSQL database via Prisma...');
    await prisma.$connect();
    logger.info('Successfully connected to the database.');
    await seedDefaultTenant();
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
