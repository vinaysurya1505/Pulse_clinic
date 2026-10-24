import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface BackupManifest {
  backupId: string;
  storeId: string;
  timestamp: string;
  totalDocuments: number;
  collections: Record<string, number>;
  sha256Checksum: string;
}

async function runDryRunRestore() {
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    console.error('❌ [RESTORE ENGINE] No backups directory found. Run backup-firestore first.');
    process.exit(1);
  }

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('_manifest.json'));
  if (files.length === 0) {
    console.error('❌ [RESTORE ENGINE] No backup manifests found in backups directory.');
    process.exit(1);
  }

  // Get most recent backup manifest
  files.sort().reverse();
  const latestManifestFile = files[0];
  const manifestPath = path.join(backupDir, latestManifestFile);
  const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const dataFileName = `${manifest.backupId}.json`;
  const dataFilePath = path.join(backupDir, dataFileName);

  if (!fs.existsSync(dataFilePath)) {
    console.error(`❌ [RESTORE ENGINE] Backup archive ${dataFileName} missing.`);
    process.exit(1);
  }

  console.log(`[RESTORE ENGINE] Starting dry-run restore verification for: ${manifest.backupId}`);
  console.log(`  - Original Store: ${manifest.storeId}`);
  console.log(`  - Timestamp: ${manifest.timestamp}`);

  // Step 1: Validate Checksum (RSK-024)
  const fileContent = fs.readFileSync(dataFilePath, 'utf-8');
  const computedHash = crypto.createHash('sha256').update(fileContent).digest('hex');

  if (computedHash !== manifest.sha256Checksum) {
    console.error(`❌ [RESTORE ENGINE] Integrity Check FAILED! Hash mismatch.`);
    console.error(`  Expected: ${manifest.sha256Checksum}`);
    console.error(`  Computed: ${computedHash}`);
    process.exit(1);
  }
  console.log(`  ✔ Integrity Check: SHA-256 Checksum verified (${computedHash.slice(0, 16)}...)`);

  // Step 2: Parse and Validate Collection Documents
  const backupData: Record<string, any[]> = JSON.parse(fileContent);
  let verifiedDocCount = 0;

  for (const [colName, docs] of Object.entries(backupData)) {
    const expectedCount = manifest.collections[colName] || 0;
    if (docs.length !== expectedCount) {
      console.error(`❌ [RESTORE ENGINE] Count mismatch in collection ${colName}: expected ${expectedCount}, found ${docs.length}`);
      process.exit(1);
    }

    // Verify all docs have non-empty IDs
    for (const d of docs) {
      if (!d.id) {
        console.error(`❌ [RESTORE ENGINE] Document in ${colName} is missing an 'id' attribute.`);
        process.exit(1);
      }
    }

    verifiedDocCount += docs.length;
    console.log(`  ✔ Collection '${colName}': verified ${docs.length} documents.`);
  }

  console.log(`\n🎉 [RESTORE ENGINE] Dry-run restore completed successfully!`);
  console.log(`  - Total Documents Verified: ${verifiedDocCount} / ${manifest.totalDocuments}`);
  console.log(`  - Integrity: 100% Match`);
  console.log(`  - Status: READY FOR RECOVERY`);
}

runDryRunRestore().catch((err) => {
  console.error('[RESTORE ENGINE] Dry-run restore failed:', err);
  process.exit(1);
});
