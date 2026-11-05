// Ré-encode une image (fichier source non fiable) : supprime métadonnées et données parasites.
// Usage : node scripts/reencode-image.mjs <source> <destination>
import sharp from 'sharp';
const [src, dest] = process.argv.slice(2);
const meta = await sharp(src).metadata();
if (!['jpeg', 'png', 'gif', 'webp'].includes(meta.format)) throw new Error(`Format refusé : ${meta.format}`);
const img = sharp(src).rotate();
await (meta.format === 'png' ? img.png() : img.jpeg({ quality: 88, mozjpeg: true })).toFile(dest);
console.log(`${src} → ${dest} (${meta.format} ${meta.width}x${meta.height})`);
