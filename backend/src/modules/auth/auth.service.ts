import bcrypt from 'bcryptjs';
import { userRepository } from './auth.repository.js';
import { AuthResponse } from './auth.types.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../common/utils/jwt.js';
import { ConflictError, BadRequestError, UnauthorizedError } from '../../common/errors/errors.js';

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
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    await userRepository.addRefreshToken(refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  static async refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!token) {
      throw new BadRequestError('Refresh token is required');
    }

    let payload: any;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const hasToken = await userRepository.hasRefreshToken(token);
    if (!hasToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Revoke old token and issue new pair (rotation)
    await userRepository.removeRefreshToken(token);

    const newAccessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.role);

    await userRepository.addRefreshToken(newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
