import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../lib/firebase-admin';

export interface AuthContext {
  uid: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid Authorization header.' },
    });
    return;
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.authContext = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email || '',
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Firebase ID token verification failed.' },
    });
  }
}
