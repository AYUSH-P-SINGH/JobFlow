import { User } from './auth.types.js';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  addRefreshToken(token: string): Promise<void>;
  hasRefreshToken(token: string): Promise<boolean>;
  removeRefreshToken(token: string): Promise<boolean>;
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();
  private refreshTokens = new Set<string>();

  async findByEmail(email: string): Promise<User | null> {
    const emailLower = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === emailLower) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = Math.random().toString(36).substring(2, 15);
    const now = new Date();
    const newUser: User = {
      ...userData,
      id,
      email: userData.email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, newUser);
    return newUser;
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

  // Helpers for testing/initialization
  async saveDirectly(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async clear(): Promise<void> {
    this.users.clear();
    this.refreshTokens.clear();
  }
}

export const userRepository = new InMemoryUserRepository();
export const authRepository = userRepository; // alias for phase 3 compatibility
