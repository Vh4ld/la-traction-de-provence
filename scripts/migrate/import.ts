/**
 * Place les pages récupérées (scripts/.cache/migrate) dans src/content/pages,
 * copie images et PDF, réécrit les liens internes. Les pages sont ensuite relues à la main.
 *
 * Usage : npx tsx scripts/migrate/import.ts scripts/.cache/migrate <dossier IMG de la sauvegarde>
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { followRedirects, resolveShortLinks, rewriteArticleLinks } from './links';
import { importImage, validateMedia } from './assets';

type Target = { section: string; slug: string; order: number; title?: string };

/** Ancienne page SPIP → emplacement dans le nouveau site (titres du menu pour les pages du menu). */
const MAP: Record<string, Target> = {
  'article-90': { section: 'vie-du-club', slug: 'index', order: 0, title: 'Vie du Club' },
  'article-53': { section: 'vie-du-club', slug: 'qui-sommes-nous', order: 1, title: 'Qui sommes-nous ?' },
  'article-42': { section: 'vie-du-club', slug: 'quai-de-javel', order: 2, title: 'Quai de Javel' },
  'article-2': { section: 'vie-du-club', slug: 'nous-rejoindre', order: 3, title: 'Nous rejoindre' },
  'article-57': { section: 'vie-du-club', slug: 'notracanou', order: 4, title: 'Notracanou' },
  'article-43': { section: 'vie-du-club', slug: 'nous-contacter', order: 5, title: 'Nous contacter' },
  'article-44': { section: 'vie-du-club', slug: 'lou-coumpan', order: 6, title: 'Lou Coumpan' },
  'rubrique-5': { section: 'vie-du-club', slug: 'les-tractionnettes', order: 7, title: 'Les Tractionnettes' },
  'article-11': { section: 'almanach', slug: 'index', order: 0, title: 'Almanach' },
  'article-70': { section: 'routracs', slug: 'index', order: 0, title: 'Nos Routracs' },
  'article-48': { section: 'photo-du-mois', slug: 'index', order: 0, title: 'Photo du mois' },
  'article-76': { section: 'mains-sales', slug: 'index', order: 0, title: 'Les mains sales' },
  'article-55': { section: 'mains-sales', slug: 'dictionnaire-des-reparations', order: 1, title: 'Dictionnaire des réparations' },
  'article-68': { section: 'mains-sales', slug: 'catalogue-des-pieces-detachees', order: 2, title: 'Catalogue des pièces détachées' },
  'article-66': { section: 'mains-sales', slug: 'revues-techniques', order: 3, title: 'Revues techniques' },
  'article-61': { section: 'mains-sales', slug: 'manuels-et-notices', order: 4, title: 'Manuels et notices' },
  'article-56': { section: 'mains-sales', slug: 'electricite', order: 5, title: 'Électricité' },
  'article-65': { section: 'mains-sales', slug: 'graissage', order: 6, title: 'Graissage' },
  'article-62': { section: 'mains-sales', slug: 'carrosserie', order: 7, title: 'Carrosserie' },
  'article-63': { section: 'mains-sales', slug: 'outils', order: 8, title: 'Outils' },
  'article-64': { section: 'mains-sales', slug: 'mecanique', order: 9, title: 'Mécanique' },
  'article-54': { section: 'mains-sales', slug: 'trucs-et-astuces', order: 10, title: 'Trucs et astuces' },
  'article-77': { section: 'de-34-a-57', slug: 'index', order: 0, title: 'De 34 à 57' },
  'article-105': { section: 'de-34-a-57', slug: 'catalogues-citroen', order: 1, title: 'Catalogues Citroën' },
  'article-71': { section: 'de-34-a-57', slug: 'publicites-d-epoque', order: 2, title: 'Publicités d’époque' },
  'article-72': { section: 'de-34-a-57', slug: 'docs-etrangeres', order: 3, title: 'Docs étrangères' },
  'article-50': { section: 'de-34-a-57', slug: 'accessoires', order: 4, title: 'Accessoires' },
  'article-51': { section: 'de-34-a-57', slug: 'jouets', order: 5, title: 'Jouets' },
  'article-73': { section: 'de-34-a-57', slug: 'remorques-et-caravanes', order: 6, title: 'Remorques et caravanes' },
  'article-91': { section: 'de-34-a-57', slug: 'boites-4-vitesses', order: 10 },
  'article-98': { section: 'de-34-a-57', slug: 'galeries-de-toit-et-porte-bagages', order: 11 },
  'article-100': { section: 'de-34-a-57', slug: 'volants-souples-quillery', order: 12 },
  'article-104': { section: 'de-34-a-57', slug: 'antivols', order: 13 },
  'article-109': { section: 'de-34-a-57', slug: 'super-accelerateur-marvel', order: 14 },
  'article-60': { section: 'infos', slug: 'mentions-legales', order: 1, title: 'Mentions légales' },
};

const urlOf = (t: Target) => (t.slug === 'index' ? `/${t.section}/` : `/${t.section}/${t.slug}/`);

/** Première phrase du texte, 50 à 160 caractères, pour la balise description. */
function describe(markdown: string, title: string): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = text.match(/^.{50,157}?[.!?…](\s|$)/)?.[0].trim() ?? (text.length >= 50 ? `${text.slice(0, 157).replace(/\s\S*$/, '')}…` : '');
  return sentence || `${title} : une rubrique du site de La Traction de Provence, club de la Citroën Traction Avant en Provence.`;
}

const src = process.argv[2];
if (!src) throw new Error('Usage : import.ts <dossier de migration>');

const urls = new Map<number, string>();
for (const [key, t] of Object.entries(MAP)) if (key.startsWith('article-')) urls.set(Number(key.slice(8)), urlOf(t));

await mkdir('src/assets/content', { recursive: true });
await mkdir('public/documents', { recursive: true });
for (const f of await readdir(join(src, 'images'))) await copyFile(join(src, 'images', f), join('src/assets/content', f));
for (const f of await readdir(join(src, 'documents'))) await copyFile(join(src, 'documents', f), join('public/documents', f));

const review: string[] = [];
for (const file of (await readdir(join(src, 'pages'))).sort()) {
  const key = file.replace(/\.md$/, '');
  const target = MAP[key];
  if (!target) {
    review.push(`${key} : non placé (hors plan du site)`);
    continue;
  }
  const raw = await readFile(join(src, 'pages', file), 'utf8');
  const [, front, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!;
  const meta = Object.fromEntries(front.split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  const title = target.title ?? JSON.parse(meta.title);
  const rewritten = rewriteArticleLinks(body.trim(), urls);
  const { unresolved } = rewritten;
  let n = 0;
  // Images sans texte alternatif (galeries) : description numérotée, à préciser à la relecture.
  const withAlt = rewritten.markdown.replace(/!\[\s*\]\(/g, () => `![${title}, photo ${++n}](`);
  const markdown = await resolveShortLinks(withAlt, followRedirects);
  if (unresolved.length) review.push(`${key} : liens vers articles non récupérés ${unresolved.join(', ')}`);

  const legacy = key.startsWith('rubrique-') ? `legacyRubriques: [${key.split('-')[1]}]` : `legacyIds: [${key.split('-')[1]}]`;
  const cover = meta.cover ? `cover: ${meta.cover}` : null;
  const out = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `section: ${target.section}`,
    `order: ${target.order}`,
    `description: ${JSON.stringify(describe(markdown, title))}`,
    legacy,
    cover,
    `# Récupéré de ${meta.source} (capture ${JSON.parse(meta.snapshot)})`,
    '---',
    '',
    markdown,
    '',
  ].filter((l) => l !== null);
  const dest = join('src/content/pages', target.section, `${target.slug}.md`);
  await mkdir(join('src/content/pages', target.section), { recursive: true });
  await writeFile(dest, out.join('\n'));
  console.log(`${key} → ${dest}`);
}
// Photos du mois : fichiers AAAAMM.jpg de la sauvegarde (validés puis ré-encodés).
const backupDir = process.argv[3];
if (backupDir) {
  await mkdir('src/assets/photo-du-mois', { recursive: true });
  for (const f of (await readdir(join(backupDir, 'jpg'))).filter((f) => /^\d{6}\.jpg$/.test(f)).sort()) {
    const check = await validateMedia(join(backupDir, 'jpg', f));
    if (!check.ok) {
      review.push(`photo du mois ${f} refusée : ${check.reason}`);
      continue;
    }
    await importImage(join(backupDir, 'jpg', f), join('src/assets/photo-du-mois', f));
  }
  console.log(`Photos du mois : ${(await readdir('src/assets/photo-du-mois')).length}`);
}

const missing = Object.keys(MAP).filter((k) => !existsSync(join(src, 'pages', `${k}.md`)));
if (missing.length) review.push(`pages attendues absentes : ${missing.join(', ')}`);
console.log('\nÀ revoir :\n' + review.map((r) => `- ${r}`).join('\n'));
