import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { spipKey, vignetteToOriginal } from './assets';

export type BackupIndex = {
  root: string;
  /** Chemin relatif en minuscules (« pdf/ac4606.pdf ») → chemin réel. */
  byPath: Map<string, string>;
  /** Nom de fichier en minuscules → chemins réels. */
  byName: Map<string, string[]>;
  /** Clé de vignette SPIP → chemins réels. */
  byKey: Map<string, string[]>;
};

const push = (map: Map<string, string[]>, key: string, value: string) => map.set(key, [...(map.get(key) ?? []), value]);

/** Index de la sauvegarde, insensible à la casse (les pages citent « AC4606.pdf », le disque a « ac4606.pdf »). */
export function buildIndex(root: string, files: string[]): BackupIndex {
  const index: BackupIndex = { root, byPath: new Map(), byName: new Map(), byKey: new Map() };
  for (const file of files) {
    const name = basename(file).toLowerCase();
    index.byPath.set(file.slice(root.length + 1).toLowerCase(), file);
    push(index.byName, name, file);
    push(index.byKey, spipKey(name), file);
  }
  return index;
}

export async function scanBackup(root: string): Promise<BackupIndex> {
  const files: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (/\.(jpe?g|png|gif|pdf)$/i.test(entry.name)) files.push(p);
    }
  };
  await walk(root);
  return buildIndex(root, files);
}

const unique = (hits?: string[]) => (hits && hits.length === 1 ? hits[0] : null);

/** Fichier de la sauvegarde correspondant à une référence du site d'origine, ou null (absent ou ambigu). */
export function findLocal(index: BackupIndex, ref: string): string | null {
  const clean = ref.split('?')[0];
  if (/^IMG\//i.test(clean)) {
    return index.byPath.get(clean.slice(4).toLowerCase()) ?? unique(index.byName.get(basename(clean).toLowerCase()));
  }
  if (clean.startsWith('local/cache-vignettes/')) {
    const o = vignetteToOriginal(clean);
    if ('exact' in o) return unique(index.byName.get(o.exact.toLowerCase()));
    // SPIP garde aussi une copie « distant/ » nommée comme la vignette : elle partage la même clé.
    const originals = (index.byKey.get(o.key.toLowerCase()) ?? []).filter((p) => !/[\\/]distant[\\/]/i.test(p));
    if (originals.length === 1) return originals[0];
    const copy = basename(clean).replace(/-[0-9a-f]{5}(\.\w+)$/i, '$1').toLowerCase();
    return unique(index.byName.get(copy));
  }
  return null;
}
