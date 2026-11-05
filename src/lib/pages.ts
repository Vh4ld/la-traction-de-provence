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
