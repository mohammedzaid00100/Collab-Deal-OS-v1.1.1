import type { CapacitorConfig } from '@capacitor/cli';

// The server-rendered application stays on the shared HTTPS backend. Only its
// public origin is embedded in Android; no environment files are copied.
const configuredOrigin = process.env.CAPACITOR_SERVER_URL?.trim();
let origin: string | undefined;
if (configuredOrigin) {
  const parsed = new URL(configuredOrigin);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('CAPACITOR_SERVER_URL must be a plain HTTPS origin.');
  }
  origin = parsed.origin;
}

const config: CapacitorConfig = {
  appId: 'com.collabdeal.os',
  appName: 'Collab Deal OS',
  webDir: 'mobile-shell',
  server: origin ? { url: origin, cleartext: false, errorPath: 'offline.html' } : { cleartext: false },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
