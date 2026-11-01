import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const env = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (env === 'development') console.warn('JWT_SECRET is missing; authentication tokens are unavailable.');
  else throw new Error('JWT_SECRET is required outside development.');
}
const encryptionKey = process.env.ENCRYPTION_KEY;
const hashPepper = process.env.HASH_PEPPER;
if (encryptionKey && !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) throw new Error('ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters.');
export const config = {
  env, port: parseInt(process.env.PORT || '5000', 10), clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwt: { secret: jwtSecret || '', expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  encryptionKey: encryptionKey || '', hashPepper: hashPepper || '',
  database: { url: process.env.DATABASE_URL || '' },
  supabase: { url: process.env.SUPABASE_URL || '', anonKey: process.env.SUPABASE_ANON_KEY || '', serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '', avatarsBucket: process.env.SUPABASE_BUCKET_AVATARS || 'mindrise-avatars' },
};
