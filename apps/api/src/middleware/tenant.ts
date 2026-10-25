import { Request, Response, NextFunction } from 'express';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import type { SystemRole, NamedPermission } from '@pulseclinic/types';
import { PERMISSION_ROLE_MAP } from '@pulseclinic/types';

export interface TenantContext {
  storeId: string;
  userRole: SystemRole;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const paramVal = req.params.storeId;
  const headerVal = req.headers['x-store-id'];
  const rawParam = Array.isArray(paramVal) ? paramVal[0] : paramVal;
  const rawHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const rawStoreId: string = rawParam || rawHeader || '';
  if (!rawStoreId) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_STORE_ID', message: 'Store ID is required.' },
    });
    return;
  }

  const uid = req.authContext?.uid;
  if (!uid) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
    });
    return;
  }

  const db = getFirestore();
  const storeId = rawStoreId;
  db.doc(`${COLLECTIONS.members(storeId)}/${uid}`)
    .get()
    .then((memberDoc) => {
      if (!memberDoc.exists) {
        // Single-store auto-provisioning for primary store
        if (storeId === 'pulseclinic-main') {
          const newMember = {
            uid,
            email: req.authContext?.email || '',
            role: 'OWNER' as SystemRole,
            status: 'ACTIVE',
            joinedAt: new Date().toISOString(),
          };
          return db.doc(`${COLLECTIONS.members(storeId)}/${uid}`).set(newMember).then(() => {
            req.tenantContext = {
              storeId,
              userRole: 'OWNER',
            };
            next();
          });
        }

        res.status(403).json({
          success: false,
          error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this store.' },
        });
        return;
      }

      const data = memberDoc.data();
      if (data?.status !== 'ACTIVE') {
        res.status(403).json({
          success: false,
          error: { code: 'MEMBERSHIP_SUSPENDED', message: 'Your store membership is suspended.' },
        });
        return;
      }

      req.tenantContext = {
        storeId,
        userRole: data.role as SystemRole,
      };
      next();
    })
    .catch((err: unknown) => {
      console.error('Tenant middleware error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to verify store membership.' },
      });
    });
}

export function requirePermission(permission: NamedPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.tenantContext?.userRole;
    if (!role) {
      res.status(403).json({
        success: false,
        error: { code: 'NO_TENANT_CONTEXT', message: 'Tenant context not established.' },
      });
      return;
    }

    if (role === 'SUPER_ADMIN') {
      return next();
    }

    const allowedRoles = PERMISSION_ROLE_MAP[permission];
    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Role ${role} is not granted permission ${permission}.`,
        },
      });
      return;
    }

    next();
  };
}
