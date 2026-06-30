import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthResponse } from '../types/user.js';
import { config } from '../config/env.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';

// In-memory user database
const users: User[] = [];

// Initialize a default admin user for convenience testing
const initAdminUser = async () => {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);
  users.push({
    id: 'admin-id-1234',
    email: 'admin@jobflow.com',
    passwordHash,
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};
initAdminUser().catch(err => console.error('Failed to initialize admin user', err));

export class AuthService {
  static async register(email: string, password: string): Promise<AuthResponse> {
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError('Invalid email format');
    }

    if (password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters long');
    }

    const existingUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new ConflictError('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: Math.random().toString(36).substring(2, 15),
      email: email.toLowerCase(),
      passwordHash,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    users.push(newUser);

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    };
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }
}
