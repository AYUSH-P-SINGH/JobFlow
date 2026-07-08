import prisma from '../../prisma.js';
import { AuditLog } from '@prisma/client';

export interface IAuditRepository {
  create(actor: string, action: string, resource: string, metadata?: any): Promise<AuditLog>;
  findAll(filters?: { actor?: string; resource?: string; action?: string }, pagination?: { page: number; limit: number }): Promise<{ auditLogs: AuditLog[]; total: number }>;
  clear(): Promise<void>;
}

export class PrismaAuditRepository implements IAuditRepository {
  async create(actor: string, action: string, resource: string, metadata?: any): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        actor,
        action,
        resource,
        metadata: metadata || null,
      },
    });
  }

  async findAll(
    filters?: { actor?: string; resource?: string; action?: string },
    pagination?: { page: number; limit: number }
  ): Promise<{ auditLogs: AuditLog[]; total: number }> {
    const where: any = {};
    if (filters?.actor) where.actor = filters.actor;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.action) where.action = filters.action;

    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const skip = (page - 1) * limit;

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { auditLogs, total };
  }

  async clear(): Promise<void> {
    await prisma.auditLog.deleteMany({});
  }
}

export const auditRepository = new PrismaAuditRepository();
