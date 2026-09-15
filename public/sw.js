/* Network-only for authenticated content: never cache account data, tokens, or APIs. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Collab Deal OS</title><body style="font:16px/1.6 system-ui;background:#f8fafc;color:#0f172a;padding:32px"><h1>You are offline</h1><p>Reconnect to continue working on your collaborations.</p><button onclick="location.reload()" style="padding:14px 20px">Retry</button></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, status: 503 },
  )));
});
