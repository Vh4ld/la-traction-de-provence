// Génère les icônes du site et l'image de partage à partir du logo et d'une photo du bandeau.
// Usage : node scripts/make-icons.mjs
import sharp from 'sharp';

const logo = 'src/assets/brand/logo.png';
const navy = { r: 7, g: 40, b: 109, alpha: 1 };

async function icon(size, dest) {
  const inner = Math.round(size * 0.86);
  const l = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: navy } })
    .composite([{ input: l, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

await icon(64, 'public/favicon.png');
await icon(180, 'public/apple-touch-icon.png');

// Image de partage 1200×630 : photo du Vieux-Port, bande ardoise et logo.
const photo = await sharp('src/assets/banner/1.jpg').resize(1200, 630, { fit: 'cover', position: 'centre' }).toBuffer();
const band = await sharp({ create: { width: 1200, height: 150, channels: 4, background: { r: 92, g: 90, b: 90, alpha: 0.92 } } }).png().toBuffer();
const l = await sharp(logo).resize({ height: 130 }).toBuffer();
await sharp(photo)
  .composite([
    { input: band, top: 480, left: 0 },
    { input: l, top: 490, left: 40 },
  ])
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile('public/og-default.jpg');
console.log('icônes et image de partage générées');
