import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // 1. Zod Validation Errors (400)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details: err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    });
  }

  // 2. Controlled Domain/Application Errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    });
  }

  // 3. Body Parser Payload Too Large (413)
  if (
    typeof err === 'object' &&
    err !== null &&
    (('type' in err && (err as { type: string }).type === 'entity.too.large') ||
      ('status' in err && (err as { status: number }).status === 413))
  ) {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the 100kb limit.',
      },
    });
  }

  // 4. Body Parser Malformed JSON (400)
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: number }).status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload.',
      },
    });
  }

  // 5. Database & Prisma Error Sanitization (Never leak table/column/SQL internals)
  const isPrismaError =
    typeof err === 'object' &&
    err !== null &&
    (('name' in err && String((err as Error).name).includes('Prisma')) ||
      ('code' in err &&
        typeof (err as { code: unknown }).code === 'string' &&
        String((err as { code: string }).code).startsWith('P')));

  if (isPrismaError) {
    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred.',
      },
    });
  }

  // 6. Generic Internal Server Errors (Never leak stack traces)
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred.'
          : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.',
    },
  });
};
