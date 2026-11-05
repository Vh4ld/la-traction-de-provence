/** Pages sans contenu : erreurs de la Wayback Machine (parfois en statut 200) et page-cadre de l'ancien domaine. */
const PLACEHOLDERS = [/<frameset[\s>]/i, /Temporarily Offline/i, /<title>[^<]*Time-?out/i, /Wayback Machine has not archived/i, /504 Gateway Time-out/i];

export class ArchiveUnavailableError extends Error {}

export function isArchivePlaceholder(body: string): boolean {
  return PLACEHOLDERS.some((re) => re.test(body.slice(0, 4000)));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Téléchargement avec nouvelles tentatives et délai croissant (l'archive est instable et limite le débit). */
export async function fetchBuffer(url: string, { retries = 5, baseDelayMs = 3000 } = {}): Promise<Buffer> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'la-traction-de-provence-migration/1.0' } });
      if (res.status === 404) throw new ArchiveUnavailableError(`404 ${url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (isArchivePlaceholder(buf.subarray(0, 4000).toString('latin1'))) throw new Error(`Page d'erreur de l'archive : ${url}`);
      return buf;
    } catch (err) {
      if (err instanceof ArchiveUnavailableError) throw err;
      last = err;
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw new ArchiveUnavailableError(String(last));
}

export async function fetchText(url: string, opts?: { retries?: number; baseDelayMs?: number }): Promise<string> {
  return (await fetchBuffer(url, opts)).toString('utf8');
}

/** Version brute (sans barre d'outils de l'archive) d'une capture. */
export function waybackRawUrl(timestamp: string, url: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${url}`;
}

export async function fetchWayback(timestamp: string, url: string, opts?: { retries?: number; baseDelayMs?: number }): Promise<Buffer> {
  return fetchBuffer(waybackRawUrl(timestamp, url), opts);
}
