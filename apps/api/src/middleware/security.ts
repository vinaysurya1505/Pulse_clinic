import { Request, Response, NextFunction } from 'express';
import { Sanitizer } from '../utils/sanitizer';

/**
 * Middleware to sanitize incoming request bodies and parameters against XSS
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObjectInPlace(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObjectInPlace(req.query);
  }
  next();
}

function sanitizeObjectInPlace(target: Record<string, any>): void {
  for (const key of Object.keys(target)) {
    const val = target[key];
    if (typeof val === 'string') {
      target[key] = Sanitizer.sanitizeString(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitizeObjectInPlace(val);
    }
  }
}

/**
 * Custom security headers middleware ensuring strict browser isolation and zero sniffing
 */
export function secureHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}
