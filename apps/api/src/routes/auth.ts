import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getAuth, getFirestore } from '../lib/firebase-admin';
import { authMiddleware } from '../middleware/auth';
import { COLLECTIONS } from '@pulseclinic/config';

export const authRouter = Router();

const sessionSchema = z.object({
  idToken: z.string().min(1),
});

authRouter.post('/session', async (req: Request, res: Response) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'idToken is required.' },
    });
    return;
  }

  try {
    const decoded = await getAuth().verifyIdToken(parsed.data.idToken);
    const db = getFirestore();

    const userRef = db.collection(COLLECTIONS.users).doc(decoded.uid);
    await userRef.set(
      {
        uid: decoded.uid,
        email: decoded.email || '',
        displayName: decoded.name || decoded.email || '',
        photoURL: decoded.picture || '',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true },
    );

    let storesSnap = await db.collectionGroup('members')
      .where('uid', '==', decoded.uid)
      .where('status', '==', 'ACTIVE')
      .get();

    // Single-store auto-provisioning: If user has no active store, link to primary store
    if (storesSnap.empty) {
      const allStores = await db.collection(COLLECTIONS.stores).limit(1).get();
      let targetStoreId: string;
      let targetStoreName: string;

      if (allStores.empty) {
        targetStoreId = 'pulseclinic-main';
        targetStoreName = 'PulseClinic Pharmacy';
        await db.collection(COLLECTIONS.stores).doc(targetStoreId).set({
          storeName: targetStoreName,
          tradeName: 'PulseClinic Pharmacy',
          phone: '',
          email: decoded.email || '',
          invoicePrefix: 'INV',
          status: 'ACTIVE',
          enableDoctorCommission: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: decoded.uid,
        });
      } else {
        targetStoreId = allStores.docs[0].id;
        targetStoreName = allStores.docs[0].data()?.storeName || 'PulseClinic Pharmacy';
      }

      await db.doc(`${COLLECTIONS.members(targetStoreId)}/${decoded.uid}`).set(
        {
          uid: decoded.uid,
          email: decoded.email || '',
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date().toISOString(),
          createdBy: decoded.uid,
        },
        { merge: true },
      );

      res.json({
        success: true,
        user: {
          uid: decoded.uid,
          email: decoded.email,
          name: decoded.name || decoded.email,
        },
        memberships: [
          {
            storeId: targetStoreId,
            role: 'OWNER',
            storeName: targetStoreName,
          },
        ],
      });
      return;
    }

    const memberships = await Promise.all(
      storesSnap.docs.map(async (memberDoc) => {
        const storeId = memberDoc.ref.parent.parent?.id;
        if (!storeId) return null;
        const storeDoc = await db.collection(COLLECTIONS.stores).doc(storeId).get();
        const storeData = storeDoc.data();
        return {
          storeId,
          role: memberDoc.data().role,
          storeName: storeData?.storeName || 'PulseClinic Pharmacy',
        };
      }),
    );

    res.json({
      success: true,
      user: {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email,
      },
      memberships: memberships.filter(Boolean),
    });
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Invalid Firebase ID token.' },
    });
  }
});

authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.authContext,
  });
});

const selectStoreSchema = z.object({
  storeId: z.string().min(1),
});

authRouter.post('/select-store', authMiddleware, async (req: Request, res: Response) => {
  const parsed = selectStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'storeId is required.' },
    });
    return;
  }

  const { storeId } = parsed.data;
  const uid = req.authContext!.uid;
  const db = getFirestore();

  try {
    const memberDoc = await db.doc(`${COLLECTIONS.members(storeId)}/${uid}`).get();
    if (!memberDoc.exists || memberDoc.data()?.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: { code: 'NOT_A_MEMBER', message: 'You are not an active member of this store.' },
      });
      return;
    }

    const memberData = memberDoc.data()!;
    const storeDoc = await db.collection(COLLECTIONS.stores).doc(storeId).get();
    const storeData = storeDoc.data();

    res.json({
      success: true,
      activeStore: {
        storeId,
        storeName: storeData?.storeName || 'Unknown Store',
        role: memberData.role,
        permissions: getPermissionsForRole(memberData.role),
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to select store.' },
    });
  }
});

function getPermissionsForRole(role: string): string[] {
  const { PERMISSION_ROLE_MAP } = require('@pulseclinic/types');
  return Object.entries(PERMISSION_ROLE_MAP)
    .filter(([, roles]) => (roles as string[]).includes(role))
    .map(([perm]) => perm);
}
