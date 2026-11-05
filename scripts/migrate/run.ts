/**
 * Récupération du contenu de l'ancien site SPIP.
 * - Textes : Wayback Machine, captures antérieures au 01/07/2023 (début de la compromission).
 * - Fichiers : sauvegarde locale IMG/ en priorité, archive en secours ; tout fichier est validé.
 *
 * Usage : npx tsx scripts/migrate/run.ts --backup <dossier IMG> --out scripts/.cache/migrate
 */
import { copyFile, mkdir, readdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { listSnapshots, pickSnapshot, type CdxRow } from './cdx';
import { ArchiveUnavailableError, fetchWayback } from './fetch';
import { extractArticle, toMarkdown } from './extract';
import { importImage, spipKey, validateMedia, vignetteToOriginal } from './assets';

const HOSTS = ['s631887927.onlinehome.fr', 'www.la-traction-de-provence.fr', 'la-traction-de-provence.fr'];

/** Articles du menu 2024, et autres articles archivés à examiner. */
const SEEDS = [90, 53, 42, 2, 57, 43, 44, 11, 70, 48, 76, 55, 68, 66, 61, 56, 65, 62, 63, 64, 54, 77, 105, 71, 72, 50, 51, 73, 60, 91, 98, 100, 104, 109];
/** « Forum privé » : le forum n'est pas recréé. */
const EXCLUDED = new Set([74]);
const MAX_DEPTH = 2;

const { values } = parseArgs({ options: { backup: { type: 'string' }, out: { type: 'string' } } });
if (!values.backup || !values.out) throw new Error('Usage : --backup <dossier IMG> --out <dossier>');
const BACKUP = values.backup;
const OUT = values.out;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

type Report = {
  id: string;
  title?: string;
  snapshot?: string | null;
  source?: string;
  parent?: number;
  flags: string[];
  missingAssets: string[];
  error?: string;
};

async function snapshotsFor(path: string): Promise<{ rows: CdxRow[]; url: string }[]> {
  const out = [];
  for (const host of HOSTS) {
    const url = `http://${host}/${path}`;
    try {
      out.push({ rows: await listSnapshots(url), url });
    } catch (e) {
      log('CDX échec', url, String(e));
    }
    await sleep(1000);
  }
  return out;
}

/** Meilleure capture (la plus récente avant la date limite) parmi les variantes d'URL. */
async function bestCapture(paths: string[]): Promise<{ ts: string; url: string } | null> {
  let best: { ts: string; url: string } | null = null;
  for (const path of paths) {
    for (const { rows, url } of await snapshotsFor(path)) {
      const ts = pickSnapshot(rows);
      if (ts && (!best || ts > best.ts)) best = { ts, url };
    }
  }
  return best;
}

/** Index de la sauvegarde : nom de fichier → chemins, et clé SPIP → chemins. */
async function indexBackup(dir: string) {
  const byName = new Map<string, string[]>();
  const byKey = new Map<string, string[]>();
  const walk = async (d: string) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (/\.(jpe?g|png|gif|pdf)$/i.test(entry.name)) {
        byName.set(entry.name, [...(byName.get(entry.name) ?? []), p]);
        byKey.set(spipKey(entry.name), [...(byKey.get(spipKey(entry.name)) ?? []), p]);
      }
    }
  };
  await walk(dir);
  return { byName, byKey };
}

const backup = await indexBackup(BACKUP);
log(`Sauvegarde indexée : ${backup.byName.size} fichiers`);

/** Trouve un fichier dans la sauvegarde locale. */
function localFile(ref: string): string | null {
  if (ref.startsWith('IMG/')) {
    const p = join(BACKUP, ref.slice(4));
    if (existsSync(p)) return p;
    return backup.byName.get(basename(ref))?.[0] ?? null;
  }
  if (ref.startsWith('local/cache-vignettes/')) {
    const o = vignetteToOriginal(ref);
    const hits = 'exact' in o ? backup.byName.get(o.exact) : backup.byKey.get(o.key);
    return hits && hits.length === 1 ? hits[0] : null;
  }
  return null;
}

await mkdir(join(OUT, 'pages'), { recursive: true });
await mkdir(join(OUT, 'images'), { recursive: true });
await mkdir(join(OUT, 'documents'), { recursive: true });

const imported = new Map<string, string>(); // référence d'origine → nom de fichier importé
const rejected: { ref: string; reason: string }[] = [];

/** Importe un fichier (sauvegarde puis archive), le valide ; renvoie son nouveau nom ou null. */
async function importAsset(ref: string): Promise<string | null> {
  if (imported.has(ref)) return imported.get(ref)!;
  const isPdf = /\.pdf$/i.test(ref);
  let src = localFile(ref);
  let origin = 'sauvegarde';
  if (!src) {
    const cap = await bestCapture([ref]);
    if (!cap) return null;
    try {
      const buf = await fetchWayback(cap.ts, cap.url);
      src = join(OUT, '.download', basename(ref.split('?')[0]));
      await mkdir(join(OUT, '.download'), { recursive: true });
      await writeFile(src, buf);
      origin = `archive ${cap.ts}`;
    } catch (e) {
      log('fichier introuvable', ref, String(e));
      return null;
    }
  }
  const check = await validateMedia(src);
  if (!check.ok) {
    rejected.push({ ref, reason: check.reason });
    log('REFUSÉ', ref, check.reason);
    return null;
  }
  let name = basename(src).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  if (isPdf) {
    await copyFile(src, join(OUT, 'documents', name));
  } else {
    if (name.endsWith('.gif')) name = name.replace(/\.gif$/, '.png');
    await importImage(src, join(OUT, 'images', name));
  }
  log('fichier', ref, '→', name, `(${origin})`);
  imported.set(ref, name);
  return name;
}

const report: Report[] = [];
const queue: { id: number; depth: number; parent?: number }[] = SEEDS.map((id) => ({ id, depth: 0 }));
const seen = new Set<number>();

async function migratePage(key: string, paths: string[], meta: { parent?: number }) {
  const entry: Report = { id: key, flags: [], missingAssets: [], parent: meta.parent };
  report.push(entry);
  const cap = await bestCapture(paths);
  entry.snapshot = cap?.ts ?? null;
  if (!cap) {
    entry.error = 'aucune capture avant le 01/07/2023';
    log(key, entry.error);
    return null;
  }
  entry.source = cap.url;
  let html: string;
  try {
    html = (await fetchWayback(cap.ts, cap.url)).toString('utf8');
  } catch (e) {
    entry.error = e instanceof ArchiveUnavailableError ? `archive indisponible : ${e.message}` : String(e);
    return null;
  }
  const article = extractArticle(html);
  entry.title = article.title;
  entry.flags = article.flags;

  let body = article.html;
  for (const ref of article.images) {
    const name = await importAsset(ref);
    if (name) body = body.split(ref).join(`../../../assets/content/${name}`);
    else entry.missingAssets.push(ref);
  }
  for (const ref of article.pdfs) {
    if (!(await importAsset(ref))) entry.missingAssets.push(ref);
  }
  const cover = article.logo ? await importAsset(article.logo) : null;
  if (article.logo && !cover) entry.missingAssets.push(article.logo);

  const markdown = toMarkdown(body);
  const front = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `snapshot: "${cap.ts}"`,
    `source: ${JSON.stringify(cap.url)}`,
    cover ? `cover: ../../../assets/content/${cover}` : null,
    `articleLinks: [${article.articleLinks.join(', ')}]`,
    '---',
  ].filter(Boolean);
  await writeFile(join(OUT, 'pages', `${key}.md`), `${front.join('\n')}\n\n${markdown}\n`);
  log(key, `« ${article.title} »`, cap.ts, `${article.pdfs.length} PDF, ${article.images.length} images, ${article.flags.length} alertes`);
  return article;
}

while (queue.length) {
  const { id, depth, parent } = queue.shift()!;
  if (seen.has(id) || EXCLUDED.has(id)) continue;
  seen.add(id);
  const article = await migratePage(`article-${id}`, [`spip.php?page=article&id_article=${id}`, `spip.php?article${id}`], { parent });
  if (article && depth < MAX_DEPTH) {
    for (const linked of article.articleLinks) if (!seen.has(linked)) queue.push({ id: linked, depth: depth + 1, parent: id });
  }
}

const rub = await migratePage('rubrique-5', ['spip.php?page=rubrique&id_rubrique=5', 'spip.php?rubrique5'], {});
for (const linked of rub?.articleLinks ?? []) {
  if (seen.has(linked) || EXCLUDED.has(linked)) continue;
  seen.add(linked);
  await migratePage(`article-${linked}`, [`spip.php?page=article&id_article=${linked}`, `spip.php?article${linked}`], { parent: -5 });
}

const sizes = { documents: 0, images: 0 };
for (const dir of ['documents', 'images'] as const) {
  for (const f of await readdir(join(OUT, dir))) sizes[dir] += (await stat(join(OUT, dir, f))).size;
}
await writeFile(join(OUT, 'report.json'), JSON.stringify({ pages: report, rejected, sizes }, null, 2));
log(`Terminé : ${report.length} pages, ${imported.size} fichiers, ${rejected.length} refusés.`,
  `PDF ${(sizes.documents / 1048576).toFixed(1)} Mo, images ${(sizes.images / 1048576).toFixed(1)} Mo`);
