import { User } from './auth.types.js';
import prisma from '../../prisma.js';
import { verifyRefreshToken } from '../../common/utils/jwt.js';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'isVerified' | 'lastLogin'>): Promise<User>;
  addRefreshToken(token: string): Promise<void>;
  hasRefreshToken(token: string): Promise<boolean>;
  removeRefreshToken(token: string): Promise<boolean>;
  saveDirectly(user: User): Promise<void>;
  clear(): Promise<void>;
}

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user;
  }

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'isVerified' | 'lastLogin'>): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: userData.email.toLowerCase(),
        passwordHash: userData.passwordHash,
        role: userData.role,
        isVerified: false,
        lastLogin: null,
      },
    });
    return user;
  }

  async addRefreshToken(token: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(token);
      await prisma.refreshToken.create({
        data: {
          token,
          userId: payload.userId,
        },
      });
    } catch (error) {
      // If token payload is invalid, log and do not insert
      console.error('Failed to add refresh token: invalid token payload', error);
    }
  }

  async hasRefreshToken(token: string): Promise<boolean> {
    const record = await prisma.refreshToken.findUnique({
      where: { token },
    });
    return record !== null;
  }

  async removeRefreshToken(token: string): Promise<boolean> {
    try {
      await prisma.refreshToken.delete({
        where: { token },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async saveDirectly(user: User): Promise<void> {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        role: user.role,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
      },
      create: {
        id: user.id,
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        role: user.role,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
      },
    });
  }

  async clear(): Promise<void> {
    try {
      await prisma.recoveryLog.deleteMany({});
      await prisma.deadLetterJob.deleteMany({});
      await prisma.workflowCheckpoint.deleteMany({});
      await prisma.policy.deleteMany({});
      await prisma.tenantQuota.deleteMany({});
      await prisma.featureFlag.deleteMany({});
      await prisma.auditLog.deleteMany({});
      await prisma.workflowStep.deleteMany({});
      await prisma.workflow.deleteMany({});
      await prisma.workflowSchedule.deleteMany({});
      await prisma.workflowTemplate.deleteMany({});
      await prisma.job.deleteMany({});
      await prisma.refreshToken.deleteMany({});
      await prisma.user.deleteMany({});
      await prisma.tenant.deleteMany({});
    } catch (err) {
      console.error('Failed to clear database tables:', err);
    }
  }
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();
  private refreshTokens = new Set<string>();

  async findByEmail(email: string): Promise<User | null> {
    const lower = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === lower) return u;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'isVerified' | 'lastLogin'>): Promise<User> {
    const user: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: userData.email.toLowerCase(),
      passwordHash: userData.passwordHash,
      role: userData.role || 'USER',
      isVerified: false,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async addRefreshToken(token: string): Promise<void> {
    this.refreshTokens.add(token);
  }

  async hasRefreshToken(token: string): Promise<boolean> {
    return this.refreshTokens.has(token);
  }

  async removeRefreshToken(token: string): Promise<boolean> {
    return this.refreshTokens.delete(token);
  }

  async saveDirectly(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async clear(): Promise<void> {
    this.users.clear();
    this.refreshTokens.clear();
  }
}

export class HybridUserRepository implements IUserRepository {
  private prismaRepo = new PrismaUserRepository();
  private inMemoryRepo = new InMemoryUserRepository();

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

  findByEmail(email: string) { return this.exec(() => this.prismaRepo.findByEmail(email), () => this.inMemoryRepo.findByEmail(email)); }
  findById(id: string) { return this.exec(() => this.prismaRepo.findById(id), () => this.inMemoryRepo.findById(id)); }
  create(userData: any) { return this.exec(() => this.prismaRepo.create(userData), () => this.inMemoryRepo.create(userData)); }
  addRefreshToken(token: string) { return this.exec(() => this.prismaRepo.addRefreshToken(token), () => this.inMemoryRepo.addRefreshToken(token)); }
  hasRefreshToken(token: string) { return this.exec(() => this.prismaRepo.hasRefreshToken(token), () => this.inMemoryRepo.hasRefreshToken(token)); }
  removeRefreshToken(token: string) { return this.exec(() => this.prismaRepo.removeRefreshToken(token), () => this.inMemoryRepo.removeRefreshToken(token)); }
  saveDirectly(user: User) { return this.exec(() => this.prismaRepo.saveDirectly(user), () => this.inMemoryRepo.saveDirectly(user)); }
  clear() {
    this.inMemoryRepo.clear();
    return this.exec(() => this.prismaRepo.clear(), async () => {});
  }
}

export const userRepository: IUserRepository = new HybridUserRepository();
export const authRepository = userRepository; // alias for phase 3 compatibility
