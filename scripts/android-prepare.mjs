import { spawnSync } from 'node:child_process';
const value = process.env.CAPACITOR_SERVER_URL;
if (!value) throw new Error('Set CAPACITOR_SERVER_URL to the deployed HTTPS application origin.');
const origin = new URL(value);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Use a plain HTTPS application origin.');
}
const result = spawnSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
