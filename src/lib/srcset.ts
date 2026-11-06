/** Adresse de la plus grande image d'un `srcset` à descripteurs de largeur (« 640w »). */
export function largestCandidate(srcset: string | undefined): string | undefined {
  let best: { url: string; width: number } | undefined;
  for (const candidate of (srcset ?? '').split(',')) {
    const [url, descriptor] = candidate.trim().split(/\s+/);
    const width = /^(\d+)w$/.exec(descriptor ?? '')?.[1];
    if (url && width && (!best || Number(width) > best.width)) best = { url, width: Number(width) };
  }
  return best?.url;
}
