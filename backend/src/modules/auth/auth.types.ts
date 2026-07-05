export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  isVerified: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  role: string;
}
