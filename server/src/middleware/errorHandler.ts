import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string, public details?: unknown) { super(message); this.name = 'AppError'; }
}
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } });
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message, ...(err.details === undefined ? {} : { details: err.details }) } });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err instanceof Error ? err.message : 'An unexpected error occurred.' } });
};
