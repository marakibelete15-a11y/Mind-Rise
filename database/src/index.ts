import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Support loading environment variables from nearest .env or root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Singleton PrismaClient instance.
 * Avoids exhausting database connection pool during development hot reloads.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
export * from '@prisma/client';
