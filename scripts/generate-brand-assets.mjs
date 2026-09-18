import sharp from 'sharp';
import fs from 'node:fs';

const srcPath = 'C:/Users/msi laptop/.gemini/antigravity/brain/606ceffc-16b3-4945-901d-5ac116e842f4/.user_uploaded/media_1789758379808.png';

async function generate() {
  // 1. Copy full 1024x1024 master
  fs.copyFileSync(srcPath, 'public/logo-full.png');
  console.log('Saved public/logo-full.png');

  // 2. Crop tightly to logo bounds (695 x 335)
  await sharp(srcPath)
    .extract({ left: 165, top: 342, width: 695, height: 335 })
    .toFile('public/brand-logo.png');
  console.log('Generated public/brand-logo.png');

  // 3. Crisp scaled version for web headers
  await sharp('public/brand-logo.png')
    .resize(100, 48, { fit: 'contain' })
    .toFile('public/brand-logo-small.png');
  console.log('Generated public/brand-logo-small.png');

  // 4. PWA Icons (192 and 512)
  for (const size of [192, 512]) {
    const targetW = Math.round(size * 0.88);
    const targetH = Math.round(targetW * (335 / 695));
    const resizedLogo = await sharp('public/brand-logo.png')
      .resize(targetW, targetH, { fit: 'contain' })
      .toBuffer();
    
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
    .composite([{ input: resizedLogo, gravity: 'centre' }])
    .png()
    .toFile(`public/icon-${size}.png`);
    console.log(`Generated public/icon-${size}.png`);
  }

  // 5. Square SVG Favicon (viewBox 0 0 512 512, centered logo)
  const faviconW = 460;
  const faviconH = Math.round(faviconW * (335 / 695));
  const faviconX = Math.round((512 - faviconW) / 2);
  const faviconY = Math.round((512 - faviconH) / 2);
  const logoBuf = fs.readFileSync('public/brand-logo.png');
  const b64 = logoBuf.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">\n  <image x="${faviconX}" y="${faviconY}" width="${faviconW}" height="${faviconH}" href="data:image/png;base64,${b64}" />\n</svg>\n`;
  fs.writeFileSync('public/favicon.svg', svg);
  console.log('Generated public/favicon.svg');

  // 6. Favicon PNG (32x32) & ICO
  const fav32 = await sharp('public/icon-192.png').resize(32, 32).png().toBuffer();
  fs.writeFileSync('public/favicon.png', fav32);
  fs.writeFileSync('public/favicon.ico', fav32);
  console.log('Generated public/favicon.png & public/favicon.ico');
}

generate().catch(console.error);
