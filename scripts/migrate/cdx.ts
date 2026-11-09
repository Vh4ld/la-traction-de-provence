import { fetchText } from './fetch';

/**
 * Date limite de confiance : aucune capture ultérieure n'est fiable.
 * Les premiers webshells datent de mai 2023, et le site (SPIP 3.1.9) était vulnérable à
 * CVE-2023-27372, exploitée massivement dès mars 2023 : on s'arrête avant sa publication.
 */
export const CUTOFF = '20230201000000';

export type CdxRow = { timestamp: string; status: string };

/** La plus récente capture HTTP 200 antérieure à la date limite, ou null. */
export function pickSnapshot(rows: CdxRow[], cutoff = CUTOFF): string | null {
  const ok = rows.filter((r) => r.status === '200' && r.timestamp < cutoff).map((r) => r.timestamp);
  return ok.length ? ok.sort().at(-1)! : null;
}

/** Toutes les captures d'une URL (API CDX de la Wayback Machine). */
export async function listSnapshots(url: string): Promise<CdxRow[]> {
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,statuscode`;
  const text = await fetchText(api);
  const rows = JSON.parse(text) as string[][];
  return rows.slice(1).map(([timestamp, status]) => ({ timestamp, status }));
}
