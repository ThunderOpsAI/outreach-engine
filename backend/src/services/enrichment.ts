import { spawn } from 'child_process';
import { createHash } from 'crypto';
import dns from 'dns/promises';
import { URL } from 'url';
import { Redis } from 'ioredis';
import path from 'path';
import type { EnrichmentResult } from '../types/index.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

redis.on('error', (err: any) => {
  console.error('Redis error in enrichment service:', err);
});

const EMPTY_RESULT: EnrichmentResult = {
  industry: 'Unknown',
  pain_points: [],
  signals: [],
  company_summary: ''
};

function isPrivateIP(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1') return true;
  
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4) {
    const p0 = parts[0] as number;
    const p1 = parts[1] as number;
    if (p0 === 10) return true;
    if (p0 === 127) return true;
    if (p0 === 169 && p1 === 254) return true;
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    if (p0 === 192 && p1 === 168) return true;
  }
  return false;
}

async function validateUrl(targetUrl: string): Promise<boolean> {
  if (!targetUrl || targetUrl.length > 2048) return false;
  
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() === 'localhost') return false;
    
    // Resolve DNS and check IP
    try {
      const lookupResult = await dns.lookup(parsed.hostname);
      if (isPrivateIP(lookupResult.address)) {
        return false;
      }
    } catch (e) {
      // DNS resolution failed, might not be safe or valid
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

export async function enrichCompany(companyUrl: string): Promise<EnrichmentResult> {
  try {
    const isValid = await validateUrl(companyUrl);
    if (!isValid) {
      return EMPTY_RESULT;
    }

    const hash = createHash('sha256').update(companyUrl).digest('hex');
    const cacheKey = `enrichment:${hash}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as EnrichmentResult;
      }
    } catch (e) {
      console.error('Redis get error', e);
    }

    return new Promise<EnrichmentResult>((resolve) => {
      // Spawn python script
      const scriptPath = path.resolve(process.cwd(), 'scripts', 'pipeline.py');
      const pythonProcess = spawn('python3', [scriptPath]);
      
      let stdoutData = '';
      let stderrData = '';
      let isDone = false;
      
      const timeout = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          pythonProcess.kill('SIGKILL');
          resolve(EMPTY_RESULT);
        }
      }, 3000);

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timeout);
        
        try {
          const result = JSON.parse(stdoutData.trim()) as EnrichmentResult;
          
          // Basic validation
          if (typeof result === 'object' && result !== null) {
            const finalResult: EnrichmentResult = {
              industry: result.industry || 'Unknown',
              pain_points: Array.isArray(result.pain_points) ? result.pain_points : [],
              signals: Array.isArray(result.signals) ? result.signals : [],
              company_summary: result.company_summary || ''
            };
            
            // Cache
            try {
              // 24 hours = 86400 seconds
              await redis.setex(cacheKey, 86400, JSON.stringify(finalResult));
            } catch (e) {
              console.error('Redis set error', e);
            }
            
            resolve(finalResult);
          } else {
            resolve(EMPTY_RESULT);
          }
        } catch (e) {
          console.error('Failed to parse python output:', e, stdoutData, stderrData);
          resolve(EMPTY_RESULT);
        }
      });

      pythonProcess.on('error', (err) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timeout);
        console.error('Python process error:', err);
        resolve(EMPTY_RESULT);
      });

      const input = JSON.stringify({ url: companyUrl });
      pythonProcess.stdin.write(input);
      pythonProcess.stdin.end();
    });
    
  } catch (err) {
    console.error('Enrichment error:', err);
    return EMPTY_RESULT;
  }
}
