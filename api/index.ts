import type { Request, Response } from 'express';
import app from '../src/index';

export const config = {
  maxDuration: 60,
};

/** Vercel sometimes delivers /api/* with the /api prefix already stripped. */
export default function handler(req: Request, res: Response) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = `/api${url.startsWith('/') ? url : `/${url}`}`;
  }
  return app(req, res);
}
