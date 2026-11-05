export type PageRoute = { section: string; slug: string | undefined; url: string };

/**
 * Déduit l'URL d'une page de son chemin : `pages/<rubrique>/<page>.md` → `/<rubrique>/<page>/`,
 * et `pages/<rubrique>/index.md` → `/<rubrique>/`.
 */
export function pageRoute(filePath: string): PageRoute {
  const match = filePath.replace(/\\/g, '/').match(/pages\/([^/]+)\/([^/]+)\.md$/);
  if (!match) throw new Error(`Page hors d'une rubrique : ${filePath}`);
  const [, section, name] = match;
  const slug = name === 'index' ? undefined : name;
  return { section, slug, url: slug ? `/${section}/${slug}/` : `/${section}/` };
}

type Entry = { filePath?: string; data: { title: string; order: number } };

/** Pages d'une rubrique (hors présentation), triées par ordre, avec leur adresse. */
export function sectionChildren<T extends Entry>(entries: T[], section: string): { title: string; url: string }[] {
  return entries
    .map((entry) => ({ entry, route: pageRoute(entry.filePath!) }))
    .filter(({ route }) => route.section === section && route.slug)
    .sort((a, b) => a.entry.data.order - b.entry.data.order || a.entry.data.title.localeCompare(b.entry.data.title, 'fr'))
    .map(({ entry, route }) => ({ title: entry.data.title, url: route.url }));
}
