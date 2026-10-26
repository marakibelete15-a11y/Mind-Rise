import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server .env or root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_mindrise_dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    avatarsBucket: process.env.SUPABASE_BUCKET_AVATARS || 'mindrise-avatars',
  },
};
