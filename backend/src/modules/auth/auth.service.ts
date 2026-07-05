import bcrypt from 'bcryptjs';
import { userRepository } from './auth.repository.js';
import { AuthResponse } from './auth.types.js';
import { generateAccessToken, generateRefreshToken } from '../../common/utils/jwt.js';
import { ConflictError, BadRequestError } from '../../common/errors/errors.js';

// Initialize a default admin user for convenience testing
const initAdminUser = async () => {
  const adminEmail = 'admin@jobflow.com';
  const existingAdmin = await userRepository.findByEmail(adminEmail);
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    await userRepository.saveDirectly({
      id: 'admin-id-1234',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
};
initAdminUser().catch(err => console.error('Failed to initialize admin user', err));

export class AuthService {
  static async register(email: string, password: string): Promise<AuthResponse> {
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await userRepository.create({
      email,
      passwordHash,
      role: 'USER',
    });

    const accessToken = generateAccessToken(newUser.id, newUser.role);
    const refreshToken = generateRefreshToken(newUser.id, newUser.role);

    await userRepository.addRefreshToken(refreshToken);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      accessToken,
      refreshToken,
    };
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    return {
      user: { id: 'temp-id', email, role: 'USER' },
      accessToken: 'temp-token',
      refreshToken: 'temp-refresh-token',
    };
  }

  static async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return {
      accessToken: 'temp-token',
      refreshToken: 'temp-refresh-token',
    };
  }
}
