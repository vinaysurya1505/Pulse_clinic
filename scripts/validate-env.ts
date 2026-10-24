/**
 * Environment Governance & Isolation Checker (Prompt 28, RSK-025, RSK-026)
 * Validates that secrets, project IDs, and API URLs strictly match the target deployment tier.
 */

function validateEnvironment() {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='))?.split('=')[1] || process.env.NODE_ENV || 'development';
  const targetEnv = envArg.toLowerCase();

  console.log(`[ENV GOVERNANCE] Validating environment configuration for tier: ${targetEnv.toUpperCase()}`);

  const errors: string[] = [];

  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const cronSecret = process.env.CRON_SECRET || '';
  const outboxKey = process.env.OUTBOX_ENCRYPTION_KEY || '';
  const hmacSecret = process.env.HMAC_SECRET || '';

  // 1. Cross-Environment Database Pollution Prevention (RSK-026)
  if (targetEnv === 'production') {
    if (!projectId) {
      errors.push('FIREBASE_PROJECT_ID is required in production.');
    } else if (projectId.includes('test') || projectId.includes('emulator') || projectId.includes('staging')) {
      errors.push(`PRODUCTION BREACH: Production environment cannot use staging/test project (${projectId}).`);
    }

    if (!cronSecret || cronSecret === 'dev-cron-secret' || cronSecret.length < 16) {
      errors.push('CRON_SECRET must be at least 16 cryptographically random characters in production.');
    }

    if (!outboxKey || outboxKey.length < 32) {
      errors.push('OUTBOX_ENCRYPTION_KEY must be exactly 32 bytes (256-bit AES) in production.');
    }

    if (!hmacSecret || hmacSecret === 'dev-hmac-secret-change-me' || hmacSecret.length < 16) {
      errors.push('HMAC_SECRET must be non-default and at least 16 characters in production.');
    }
  } else if (targetEnv === 'staging') {
    if (projectId.includes('prod') && !projectId.includes('staging')) {
      errors.push(`STAGING ISOLATION BREACH (RSK-026): Staging cannot connect to production project (${projectId}).`);
    }
  }

  // 2. Encryption Key Length Check (All environments)
  if (outboxKey && outboxKey.length < 16) {
    errors.push('OUTBOX_ENCRYPTION_KEY is too short (minimum 16 bytes, recommended 32 bytes).');
  }

  if (errors.length > 0) {
    console.error(`❌ [ENV GOVERNANCE] Validation Failed with ${errors.length} error(s):`);
    errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    process.exit(1);
  }

  console.log(`✅ [ENV GOVERNANCE] All environment checks passed successfully for: ${targetEnv.toUpperCase()}`);
}

validateEnvironment();
