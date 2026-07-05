import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { JWTPayload } from '../../modules/auth/auth.types.js';

export const generateAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role } as JWTPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
};

export const generateRefreshToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role } as JWTPayload, config.jwtSecret + '_refresh', {
    expiresIn: '7d',
  });
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwtSecret) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwtSecret + '_refresh') as JWTPayload;
};
