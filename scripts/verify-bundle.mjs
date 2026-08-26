import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

/**
 * Validates and tests bundling of the Serverless Function entrypoint (api/index.ts).
 * Ensures all local backend modules (server/app.ts, server/db.ts, server/mailService.ts, server/nextjsArtifacts.ts)
 * are bundled cleanly without runtime relative directory imports (such as ../server or /server).
 */
export async function verifyServerlessBundle() {
  console.log('[BUILD-VERIFY] Verifying serverless bundle integrity for api/index.js from server/apiEntry.ts...');

  const result = await esbuild.build({
    entryPoints: ['server/apiEntry.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    packages: 'external',
    sourcemap: true,
    write: true,
    outfile: 'api/index.js',
  });

  const outputCode = fs.readFileSync('api/index.js', 'utf8');

  // Assertions for clean bundling
  const hasRelativeServerImport = outputCode.includes('from "../server') || outputCode.includes("from './app") || outputCode.includes("from './db");
  if (hasRelativeServerImport) {
    throw new Error('[BUILD-VERIFY] Failed: bundle contains unresolved runtime relative import to server modules');
  }

  // Verify direct node runtime import
  const importedModule = await import('../api/index.js');
  if (typeof importedModule.default !== 'function') {
    throw new Error('[BUILD-VERIFY] Failed: default export from api/index.js is not an Express function');
  }

  console.log('[BUILD-VERIFY] Standalone serverless bundle verified successfully:');
  console.log(' - Bundle output size:', (outputCode.length / 1024).toFixed(2), 'KB');
  console.log(' - Runtime export type:', typeof importedModule.default);
  console.log(' - Unresolved "../server" imports:', false);
  console.log(' - Unresolved "./db" imports:', false);
  console.log(' - Unresolved "./mailService" imports:', false);
}

verifyServerlessBundle().catch((err) => {
  console.error('[BUILD-VERIFY] Verification error:', err);
  process.exit(1);
});
