import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../db/client.js';
import { Redis } from 'ioredis';
import { existsSync } from 'fs';
import { join } from 'path';

const router = Router();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { lazyConnect: true });

router.get('/', async (req: Request, res: Response) => {
  const checks: any = {
    supabase: 'fail',
    redis: 'fail',
    scraper: 'fail'
  };

  try {
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    if (!error) checks.supabase = 'ok';
  } catch (err) {
    console.error('Health check Supabase error:', err);
  }

  try {
    await redis.connect();
    const ping = await redis.ping();
    if (ping === 'PONG') checks.redis = 'ok';
    await redis.quit();
  } catch (err) {
    console.error('Health check Redis error:', err);
  }

  try {
    const scraperPath = join(process.cwd(), 'scripts', 'pipeline.py');
    if (existsSync(scraperPath)) checks.scraper = 'ok';
  } catch (err) {
    console.error('Health check Scraper error:', err);
  }

  const status = Object.values(checks).every(v => v === 'ok') ? 'ok' : 'degraded';

  res.json({
    status,
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks
  });
});

export default router;
