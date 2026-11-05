import { articleId } from './extract';

/**
 * Remplace les liens Markdown vers des articles SPIP par les nouvelles adresses.
 * Un article non récupéré devient du texte simple ; son numéro est renvoyé dans `unresolved`.
 */
export function rewriteArticleLinks(markdown: string, urls: Map<number, string>): { markdown: string; unresolved: number[] } {
  const unresolved = new Set<number>();
  const out = markdown.replace(/\[([^\]]*)\]\(([^)\s]*spip\.php\?[^)\s]*)\)/g, (whole, text: string, href: string) => {
    const id = articleId(href);
    if (id === null) return whole;
    const url = urls.get(id);
    if (url) return `[${text}](${url})`;
    unresolved.add(id);
    return text;
  });
  return { markdown: out, unresolved: [...unresolved] };
}

/** Destinations admises pour un lien court résolu. */
const SHORT_TARGETS = /^https:\/\/(photos\.google\.com|www\.youtube\.com|youtu\.be|www\.google\.com\/maps)\//;

/**
 * Les liens courts goo.gl peuvent cesser de fonctionner à tout moment :
 * on les remplace par leur destination finale, si elle est sûre ; sinon le lien devient du texte.
 */
export async function resolveShortLinks(markdown: string, resolve: (url: string) => Promise<string | null>): Promise<string> {
  const pattern = /\[([^\]]*)\]\((https?:\/\/(?:photos\.app\.)?goo\.gl\/[^)\s]+)\)/g;
  let out = markdown;
  for (const [whole, text, url] of markdown.matchAll(pattern)) {
    const target = await resolve(url);
    out = out.replace(whole, target && SHORT_TARGETS.test(target) ? `[${text}](${target})` : text);
  }
  return out;
}

/** Suit les redirections d'un lien court sans charger la page finale. */
export async function followRedirects(url: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    try {
      const res = await fetch(current, { method: 'HEAD', redirect: 'manual' });
      const next = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && next) current = new URL(next, current).href;
      else return res.ok && current !== url ? current : null;
    } catch {
      return null;
    }
  }
  return current;
}
