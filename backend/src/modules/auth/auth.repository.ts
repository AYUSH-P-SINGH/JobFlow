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

export const userRepository = new PrismaUserRepository();
export const authRepository = userRepository; // alias for phase 3 compatibility
