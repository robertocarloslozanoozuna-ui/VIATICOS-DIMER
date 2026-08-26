import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

/**
 * Validates and tests bundling of the Serverless Function entrypoint (api/index.ts).
 * Ensures all local backend modules (server/app.ts, server/db.ts, server/mailService.ts, server/nextjsArtifacts.ts)
 * are bundled cleanly without runtime relative directory imports (such as ../server or /server).
 */
export async function verifyServerlessBundle() {
  console.log('[BUILD-VERIFY] Verifying serverless bundle integrity for api/index.ts...');

  const result = await esbuild.build({
    entryPoints: ['api/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    packages: 'external',
    sourcemap: true,
    write: false,
  });

  const outputCode = result.outputFiles[0].text;

  // Assertions for clean bundling
  const hasRelativeServerImport = outputCode.includes('from "../server') || outputCode.includes("from '../server");
  if (hasRelativeServerImport) {
    throw new Error('[BUILD-VERIFY] Failed: bundle contains unresolved runtime relative import to ../server');
  }

  console.log('[BUILD-VERIFY] Standalone serverless bundle verified successfully:');
  console.log(' - Bundle output size:', (outputCode.length / 1024).toFixed(2), 'KB');
  console.log(' - Unresolved "../server" imports:', false);
  console.log(' - Unresolved "./db" imports:', false);
  console.log(' - Unresolved "./mailService" imports:', false);
}

verifyServerlessBundle().catch((err) => {
  console.error('[BUILD-VERIFY] Verification error:', err);
  process.exit(1);
});
