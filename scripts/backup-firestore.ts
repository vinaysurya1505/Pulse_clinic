import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeFirebaseAdmin, getFirestore } from '../apps/api/src/lib/firebase-admin';

interface BackupManifest {
  backupId: string;
  storeId: string;
  timestamp: string;
  totalDocuments: number;
  collections: Record<string, number>;
  sha256Checksum: string;
}

async function runBackup() {
  initializeFirebaseAdmin();
  const db = getFirestore();
  const storeId = process.env.STORE_ID || 'pulseclinic-main';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `pulseclinic_backup_${storeId}_${timestamp}`;

  console.log(`[BACKUP ENGINE] Initiating point-in-time Firestore backup: ${backupId}`);

  const collectionsToBackup = [
    'medicines',
    'batches',
    'invoices',
    'stockLedger',
    'expenses',
    'auditLogs',
    'notifications',
    'purchaseOrders',
  ];

  const backupData: Record<string, any[]> = {};
  const collectionCounts: Record<string, number> = {};
  let totalDocs = 0;

  for (const colName of collectionsToBackup) {
    const colRef = db.collection('stores').doc(storeId).collection(colName);
    const snapshot = await colRef.get();
    const docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    backupData[colName] = docs;
    collectionCounts[colName] = docs.length;
    totalDocs += docs.length;
    console.log(`  - Collection '${colName}': ${docs.length} documents backed up.`);
  }

  // Calculate SHA-256 Checksum for integrity validation
  const serialized = JSON.stringify(backupData, null, 2);
  const hash = crypto.createHash('sha256').update(serialized).digest('hex');

  const manifest: BackupManifest = {
    backupId,
    storeId,
    timestamp: new Date().toISOString(),
    totalDocuments: totalDocs,
    collections: collectionCounts,
    sha256Checksum: hash,
  };

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dataFilePath = path.join(backupDir, `${backupId}.json`);
  const manifestFilePath = path.join(backupDir, `${backupId}_manifest.json`);

  fs.writeFileSync(dataFilePath, serialized, 'utf-8');
  fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`✅ [BACKUP ENGINE] Backup completed successfully.`);
  console.log(`  - Archive Path: ${dataFilePath}`);
  console.log(`  - Manifest: ${manifestFilePath}`);
  console.log(`  - Total Documents: ${totalDocs}`);
  console.log(`  - SHA-256 Checksum: ${hash}`);
}

runBackup().catch((err) => {
  console.error('[BACKUP ENGINE] Backup failed:', err);
  process.exit(1);
});
