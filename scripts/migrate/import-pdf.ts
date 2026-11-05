/** Importe des PDF de la sauvegarde après validation. Usage : import-pdf.ts <pdf>... */
import { copyFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { validateMedia } from './assets';

for (const src of process.argv.slice(2)) {
  const check = await validateMedia(src);
  if (!check.ok) {
    console.log(`REFUSÉ ${src} : ${check.reason}`);
    continue;
  }
  const dest = `public/documents/${basename(src).toLowerCase()}`;
  await copyFile(src, dest);
  console.log(`${src} → ${dest}`);
}
