/**
 * Génère les tables de redirection nginx des anciennes adresses SPIP vers le nouveau site :
 *   deploy/redirects/articles.map   « 53 /vie-du-club/qui-sommes-nous/; »
 *   deploy/redirects/rubriques.map  « 5 /vie-du-club/les-tractionnettes/; »
 *   deploy/redirects/pdfs.map       « ~*^/IMG/pdf/ac4606\.pdf$ /documents/ac4606.pdf; »
 *
 * Usage : npx tsx scripts/gen-redirects.ts   (lancé aussi par le Dockerfile)
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageRoute } from '../src/lib/pages';

export type LegacyPage = { url: string; legacyIds: number[]; legacyRubriques: number[] };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function table(pages: LegacyPage[], key: 'legacyIds' | 'legacyRubriques'): string {
  const seen = new Map<number, string>();
  for (const page of pages) {
    for (const id of page[key]) {
      if (seen.has(id)) throw new Error(`Ancien numéro ${id} attribué à deux pages : ${seen.get(id)} et ${page.url}`);
      seen.set(id, page.url);
    }
  }
  return [...seen].sort(([a], [b]) => a - b).map(([id, url]) => `${id} ${url};`).join('\n') + '\n';
}

export function buildRedirectMaps(pages: LegacyPage[], pdfFiles: string[]) {
  return {
    articles: table(pages, 'legacyIds'),
    rubriques: table(pages, 'legacyRubriques'),
    // Les anciennes pages citent les PDF avec des majuscules (AC4606.pdf) : correspondance insensible à la casse.
    pdfs: pdfFiles.sort().map((f) => `~*^/IMG/pdf/${escapeRegex(f)}$ /documents/${f};`).join('\n') + '\n',
  };
}

const ids = (front: string, key: string) =>
  (front.match(new RegExp(`^${key}: \\[([^\\]]*)\\]`, 'm'))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);

async function main() {
  const root = 'src/content/pages';
  const pages: LegacyPage[] = [];
  for (const section of await readdir(root)) {
    for (const file of await readdir(join(root, section))) {
      if (!file.endsWith('.md')) continue;
      const path = join(root, section, file);
      const front = (await readFile(path, 'utf8')).split('\n---\n')[0];
      pages.push({ url: pageRoute(path).url, legacyIds: ids(front, 'legacyIds'), legacyRubriques: ids(front, 'legacyRubriques') });
    }
  }
  const pdfs = (await readdir('public/documents')).filter((f) => f.endsWith('.pdf'));
  const maps = buildRedirectMaps(pages, pdfs);
  await mkdir('deploy/redirects', { recursive: true });
  for (const [name, body] of Object.entries(maps)) await writeFile(`deploy/redirects/${name}.map`, body);
  console.log(`Redirections : ${maps.articles.split('\n').length - 1} articles, ${maps.rubriques.split('\n').length - 1} rubriques, ${pdfs.length} PDF`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
