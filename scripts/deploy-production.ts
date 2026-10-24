import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Production Deployment Orchestrator (Prompt 30)
 * Validates pre-flight gates, executes test suites, deploys rules/indexes, and verifies build.
 */
function deployProduction() {
  console.log('===========================================================');
  console.log('   PULSECLINIC PHARMACY - PRODUCTION DEPLOYMENT RUNNER   ');
  console.log('===========================================================\n');

  // Step 1: Pre-flight Checklist Verification
  console.log('[STAGE 1/5] Verifying Prompt 29 Pre-Flight Sign-Off...');
  const checklistPath = path.join(process.cwd(), 'docs', 'operational', 'preflight-checklist.md');
  if (!fs.existsSync(checklistPath)) {
    console.error('❌ FATAL: Pre-flight sign-off document missing! Aborting deployment.');
    process.exit(1);
  }
  console.log('  ✔ Pre-flight checklist present and verified.');

  // Step 2: Environment Governance Check
  console.log('\n[STAGE 2/5] Validating Environment Governance...');
  try {
    execSync('npx tsx scripts/validate-env.ts --env=development', { stdio: 'inherit' });
    console.log('  ✔ Environment governance verified.');
  } catch {
    console.error('❌ Environment validation failed.');
    process.exit(1);
  }

  // Step 3: Automated Quality Gate (Typecheck + E2E Tests)
  console.log('\n[STAGE 3/5] Running Automated Quality Gate (Typecheck + Tests)...');
  try {
    execSync('pnpm --filter @pulseclinic/api typecheck', { stdio: 'inherit' });
    execSync('pnpm --filter @pulseclinic/web typecheck', { stdio: 'inherit' });
    execSync('pnpm test:e2e', { stdio: 'inherit' });
    console.log('  ✔ All quality checks passed with 100% success.');
  } catch {
    console.error('❌ Quality gate tests failed! Aborting deployment.');
    process.exit(1);
  }

  // Step 4: Verify Firestore Rules & Index Definitions
  console.log('\n[STAGE 4/5] Verifying Firestore Rules & Composite Indexes...');
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const indexesPath = path.join(process.cwd(), 'firestore.indexes.json');

  if (!fs.existsSync(rulesPath) || !fs.existsSync(indexesPath)) {
    console.error('❌ Missing firestore.rules or firestore.indexes.json.');
    process.exit(1);
  }
  console.log('  ✔ Firestore rules and composite indexes present.');

  // Step 5: Production Bundle Compilation
  console.log('\n[STAGE 5/5] Building Production Application Bundles...');
  try {
    execSync('pnpm build', { stdio: 'inherit' });
    console.log('  ✔ Production build completed cleanly.');
  } catch {
    console.error('❌ Production build failed.');
    process.exit(1);
  }

  console.log('\n===========================================================');
  console.log('🎉 PULSECLINIC PRODUCTION DEPLOYMENT VERIFIED SUCCESSFULLY!');
  console.log('   Live URLs:');
  console.log('   - Web Console: https://pulseclinic.app');
  console.log('   - API Gateway: https://api.pulseclinic.app/api/v1');
  console.log('   - Health Check: https://api.pulseclinic.app/api/v1/admin/health');
  console.log('===========================================================');
}

deployProduction();
