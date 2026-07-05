import { AuthResponse } from './auth.types.js';

export class AuthService {
  static async register(email: string, password: string): Promise<AuthResponse> {
    return {
      user: { id: 'temp-id', email, role: 'USER' },
      accessToken: 'temp-token',
      refreshToken: 'temp-refresh-token',
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
