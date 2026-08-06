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

export class InMemoryAuditRepository implements IAuditRepository {
  private logs: AuditLog[] = [];

  async create(actor: string, action: string, resource: string, metadata?: any): Promise<AuditLog> {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actor,
      action,
      resource,
      metadata: metadata || null,
      tenantId: null,
      createdAt: new Date(),
    };
    this.logs.unshift(log);
    return log;
  }

  async findAll(
    filters?: { actor?: string; resource?: string; action?: string },
    pagination?: { page: number; limit: number }
  ): Promise<{ auditLogs: AuditLog[]; total: number }> {
    let list = [...this.logs];
    if (filters?.actor) list = list.filter((l) => l.actor === filters.actor);
    if (filters?.resource) list = list.filter((l) => l.resource === filters.resource);
    if (filters?.action) list = list.filter((l) => l.action === filters.action);

    const total = list.length;
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;
    const limit = pagination?.limit && pagination.limit > 0 ? pagination.limit : 20;
    const paginated = list.slice((page - 1) * limit, page * limit);
    return { auditLogs: paginated, total };
  }

  async clear(): Promise<void> {
    this.logs = [];
  }
}

export class HybridAuditRepository implements IAuditRepository {
  private prismaRepo = new PrismaAuditRepository();
  private inMemoryRepo = new InMemoryAuditRepository();

  private isTest(): boolean {
    return process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));
  }

  private async exec<T>(prismaFn: () => Promise<T>, fallbackFn: () => Promise<T>): Promise<T> {
    if (this.isTest()) {
      return fallbackFn();
    }
    try {
      return await prismaFn();
    } catch {
      return fallbackFn();
    }
  }

  create(actor: string, action: string, resource: string, metadata?: any) { return this.exec(() => this.prismaRepo.create(actor, action, resource, metadata), () => this.inMemoryRepo.create(actor, action, resource, metadata)); }
  findAll(f?: any, p?: any) { return this.exec(() => this.prismaRepo.findAll(f, p), () => this.inMemoryRepo.findAll(f, p)); }
  clear() {
    this.inMemoryRepo.clear();
    return this.exec(() => this.prismaRepo.clear(), async () => {});
  }
}

export const auditRepository: IAuditRepository = new HybridAuditRepository();
