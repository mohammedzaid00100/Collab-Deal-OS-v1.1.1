import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/client', { recursive: true });

await copyFile(
  'public/google66c0144803cee571.html',
  'dist/client/google66c0144803cee571.html'
);

console.log('Google Search Console verification file copied to dist/client.');
