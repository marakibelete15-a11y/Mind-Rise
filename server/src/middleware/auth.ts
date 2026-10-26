import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthUserPayload {
  id: string;
  role: 'YOUTH' | 'MODERATOR' | 'ADMIN';
  verified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Placeholder JWT Authentication Middleware
 * Validates Bearer token and attaches safe context to req.user.
 * CRITICAL: Real names, phone numbers, and emails are NEVER stored in JWT or attached to req.user.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authorization token missing or malformed.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token has expired or is invalid.',
      },
    });
  }
};
