// Rasterize the brand logo into PWA icons
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const logoPath = fileURLToPath(new URL('../public/brand-logo.png', import.meta.url));

for (const size of [192, 512]) {
  const targetW = Math.round(size * 0.88);
  const targetH = Math.round(targetW * (335 / 695));
  const resizedLogo = await sharp(logoPath)
    .resize(targetW, targetH, { fit: 'contain' })
    .toBuffer();
  
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: resizedLogo, gravity: 'centre' }])
    .png()
    .toFile(fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)));
}
console.log('PWA icons updated successfully.');

