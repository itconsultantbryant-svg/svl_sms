import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Express body-parser: logo/base64 payloads over default 100kb
  const anyErr = err as any;
  if (anyErr?.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
    res.status(413).json({
      error: 'Upload too large. Please use a smaller school logo (under 1MB) or try again after the server update.',
      details: err.message,
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
