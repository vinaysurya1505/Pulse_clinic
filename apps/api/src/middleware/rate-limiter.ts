import { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitBucket>();

export function rateLimiter(options: { maxRequests: number; windowSeconds: number }) {
  const { maxRequests, windowSeconds } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}_${req.baseUrl || req.path}`;
    const now = Date.now();

    let bucket = memoryStore.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      };
      memoryStore.set(key, bucket);
    } else {
      bucket.count++;
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (bucket.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Rate limit exceeded. Please wait before retrying.',
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    next();
  };
}
