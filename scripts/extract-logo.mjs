// Extrait le logo du bandeau d'origine (header-blue.png) avec un fond transparent.
// Usage : node scripts/extract-logo.mjs <header-blue.png> <logo.png> <apercu.png>
import sharp from 'sharp';
const [src, dest, preview] = process.argv.slice(2);
// Zone du logo dans le bandeau 1220x200 : on rogne puis on rend transparent le fond gris uni #5C5A5A.
const { data, info } = await sharp(src).extract({ left: 15, top: 2, width: 225, height: 196 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const bg = [0x5c, 0x5a, 0x5a];
for (let i = 0; i < data.length; i += 4) {
  const d = Math.max(Math.abs(data[i]-bg[0]), Math.abs(data[i+1]-bg[1]), Math.abs(data[i+2]-bg[2]));
  if (d <= 6) data[i+3] = 0;
  else if (d <= 30) data[i+3] = Math.round(255 * (d - 6) / 24); // bord adouci
}
const img = sharp(data, { raw: info }).trim();
await img.clone().png({ compressionLevel: 9 }).toFile(dest);
const m = await sharp(dest).metadata();
console.log('logo', m.width, m.height);
// aperçu sur fond clair et sombre
const l = await sharp(dest).toBuffer();
await sharp({ create: { width: m.width*2+30, height: m.height+20, channels: 4, background: '#1F1F1F' } })
  .composite([{ input: { create: { width: m.width+15, height: m.height+20, channels: 4, background: '#F6F1E4' } }, left: m.width+15, top: 0 },
              { input: l, left: 5, top: 10 }, { input: l, left: m.width+20, top: 10 }]).png().toFile(preview);
