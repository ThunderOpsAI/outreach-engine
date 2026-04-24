import type { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = ulid();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
};
