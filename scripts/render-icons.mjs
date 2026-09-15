// Rasterize the existing symbol; keep artwork centralized in favicon.svg.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const symbol = await readFile(new URL('../public/favicon.svg', import.meta.url));
for (const size of [192, 512]) {
  const inset = Math.round(size * 0.16);
  const foreground = await sharp(symbol).resize(size - inset * 2, size - inset * 2).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: foreground, gravity: 'centre' }]).png()
    .toFile(fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)));
}
