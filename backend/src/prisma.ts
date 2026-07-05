// Global shared PrismaClient instance
import { PrismaClient } from '@prisma/client/index.js';

export const prisma = new PrismaClient();

export default prisma;
