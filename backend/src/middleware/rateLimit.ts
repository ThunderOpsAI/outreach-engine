import type { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env', quiet: true });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

redis.on('error', (err: any) => {
  console.error('Redis error:', err);
});

export const rateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const { user_id, plan } = req.user;
  const limit = plan === 'agency' ? 60 : plan === 'pro' ? 20 : 5;
  const key = `ratelimit:${user_id}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  try {
    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, now - windowMs);
    multi.zadd(key, now, now.toString());
    multi.zcard(key);
    multi.expire(key, 60);
    
    const results = await multi.exec();
    
    if (results && results[2]) {
      const count = results[2][1] as number;
      if (count > limit) {
        return res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          retryAfter: 60
        });
      }
    }
  } catch (err) {
    console.error('Rate limit error:', err);
    // Fail open as per HANDOVER.md
  }

  next();
};
