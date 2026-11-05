import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

export type MediaType = 'pdf' | 'jpeg' | 'png' | 'gif' | 'webp' | 'html' | 'unknown';

/** Type réel d'un fichier d'après ses premiers octets (jamais d'après l'extension). */
export function sniffType(buf: Buffer): MediaType {
  const head = buf.subarray(0, 16);
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (/^GIF8[79]a/.test(head.subarray(0, 6).toString('latin1'))) return 'gif';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (/^\s*(<!doctype|<html|<\?xml|<head|<body)/i.test(buf.subarray(0, 200).toString('latin1'))) return 'html';
  return 'unknown';
}

const EXPECTED: Record<string, MediaType> = { pdf: 'pdf', jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif', webp: 'webp' };

/** Marqueurs de code qui n'ont rien à faire dans une image ou un PDF. */
const CODE_MARKERS = [/<\?php/i, /<script/i, /eval\s*\(/i, /base64_decode\s*\(/i];

/** Actions PDF dangereuses : JavaScript, lancement de programme, fichier joint. */
const PDF_DANGER = [/\/JavaScript\b/, /\/JS\s*[(<\/]/, /\/Launch\b/, /\/EmbeddedFile\b/, /\/RichMedia\b/, /\/SubmitForm\b/, /\/ImportData\b/];

export type Validation = { ok: true; type: MediaType } | { ok: false; reason: string };

export async function validateMedia(path: string): Promise<Validation> {
  const buf = await readFile(path);
  const ext = path.split('.').pop()!.toLowerCase();
  const type = sniffType(buf);
  if (EXPECTED[ext] !== type) return { ok: false, reason: `type réel « ${type} » pour l'extension .${ext}` };

  const text = buf.toString('latin1');
  const marker = CODE_MARKERS.find((re) => re.test(text));
  if (marker) return { ok: false, reason: `code détecté (${marker})` };

  if (type === 'pdf') {
    const danger = PDF_DANGER.find((re) => re.test(text));
    if (danger) return { ok: false, reason: `action PDF interdite (${danger})` };
    // /OpenAction n'est admis que s'il désigne simplement une page : [n 0 R /XYZ …] ou /Fit…
    for (const m of text.matchAll(/\/OpenAction\s*(\S.{0,40})/gs)) {
      if (!/^\[\s*\d+\s+\d+\s+R\s*\/(XYZ|Fit\w*)/.test(m[1])) return { ok: false, reason: '/OpenAction non standard' };
    }
  }
  return { ok: true, type };
}

/** Ré-encode une image : supprime métadonnées et toute donnée ajoutée après l'image. */
export async function importImage(src: string, dest: string): Promise<void> {
  const meta = await sharp(src).metadata();
  const img = sharp(src).rotate();
  if (meta.format === 'png') await img.png({ compressionLevel: 9 }).toFile(dest);
  else if (meta.format === 'gif') await img.png().toFile(dest.replace(/\.gif$/i, '.png'));
  else await img.jpeg({ quality: 88, mozjpeg: true }).toFile(dest);
}

/**
 * Nom d'origine d'une vignette SPIP (local/cache-vignettes/…) :
 * - logos d'article / rubrique : « arton53-d3405.jpg » → exact « arton53.jpg » ;
 * - documents : 12 premiers caractères de (nom + extension + « docid ») suivis de 4 caractères hexadécimaux.
 */
export function vignetteToOriginal(src: string): { exact: string } | { key: string } {
  const file = src.split('?')[0].split('/').pop()!;
  const [, base, ext] = file.match(/^(.+)-[0-9a-f]{5}\.(\w+)$/i) ?? [, file.replace(/\.\w+$/, ''), file.split('.').pop()];
  if (/^(arton|rubon|siteon)\d+$/.test(base!)) return { exact: `${base}.${ext}` };
  if (base!.length === 16 && /[0-9a-f]{4}$/.test(base!)) return { key: base!.slice(0, 12) };
  return { exact: `${base}.${ext}` };
}

/** Clé SPIP calculée depuis un nom de fichier d'origine, comparable à `vignetteToOriginal().key`. */
export function spipKey(filename: string): string {
  const m = filename.match(/^(.+)\.(\w+)$/);
  const [stem, ext] = m ? [m[1], m[2]] : [filename, ''];
  return `${stem}${ext}docid`.slice(0, 12);
}
