import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import TurndownService from 'turndown';

/** Domaines dont les liens sont conservés ; tout autre lien externe est retiré et signalé. */
const ALLOWED_HOSTS = [
  'la-traction-de-provence.fr',
  's631887927.onlinehome.fr',
  'web.archive.org',
  'citroen.com',
  'citroen.fr',
  'wikipedia.org',
  'traction-avant.com',
  'citroen-origins.fr',
  // Vidéos et albums photo du club
  'youtube.com',
  'youtu.be',
  'photos.google.com',
  'photos.app.goo.gl',
  'goo.gl',
  // Clubs amis et fournisseurs (page « Lou Coumpan »), vérifiés le 05/11/2026 : toujours en ligne et sur le thème
  'amrcv.fr',
  'rouler-en-traction-avant.blog4ever.com',
  'traction1934.free.fr',
  'tractionavant7b.free.fr',
  'traction.valdesarre.fr',
  'une.traction.pour.jean.moulin.over-blog.com',
  'une-traction-pour-jean-moulin.over-blog.com',
  '34-57.ch',
  'rackkatrac.com',
  'traction15six.com',
  'tractionavant7a.net',
  'tractionclubdesvolcans.sitew.fr',
  'tractionrhonealpes.com',
];

/** Balises supprimées avec leur contenu. */
const DROP = 'script, style, iframe, object, embed, form, input, button, select, textarea, noscript, template, svg, link, meta, base, frame, frameset, applet';

/** Balises conservées (sans leurs attributs, sauf href/src/alt) ; les autres sont déballées. */
const KEEP = new Set(['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'img', 'blockquote']);

/** Icônes de type de document générées par SPIP (pdf-39070.png…), sans intérêt. */
const DOC_ICON = /\/(pdf|doc|docx|zip|xls|odt)-[0-9a-f]+\.png/i;

export type Article = {
  title: string;
  html: string;
  logo: string | null;
  images: string[];
  pdfs: string[];
  /** Anciens numéros d'articles liés depuis cette page. */
  articleLinks: number[];
  flags: string[];
};

const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** Chemin relatif au site d'origine (« IMG/pdf/x.pdf »), sans hôte ni paramètres ; null si externe. */
export function sitePath(href: string): string | null {
  const m = href.trim().match(/^(?:https?:\/\/(?:www\.)?(?:s631887927\.onlinehome\.fr|la-traction-de-provence\.fr)(?::80)?)?\/?([^?#]*)/i);
  if (!m || /^[a-z]+:/i.test(href.trim()) && !/onlinehome\.fr|la-traction-de-provence\.fr/i.test(href)) return null;
  return m[1];
}

/** Numéro d'article SPIP visé par un lien, s'il y en a un. */
export function articleId(href: string): number | null {
  const m = href.match(/spip\.php\?(?:page=article&(?:amp;)?id_article=|article)(\d+)/i) ?? href.match(/[?&](?:amp;)?id_article=(\d+)/i);
  return m ? Number(m[1]) : null;
}

function isHidden($el: cheerio.Cheerio<Element>): boolean {
  const style = ($el.attr('style') ?? '').replace(/\s/g, '').toLowerCase();
  return $el.is('[hidden]') || /display:none|visibility:hidden|font-size:0|left:-\d{3,}/.test(style);
}

function hostAllowed(href: string): boolean {
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Extrait et nettoie le corps d'un article d'une page SPIP « Party » archivée. */
export function extractArticle(page: string): Article {
  const flags: string[] = [];
  const $page = cheerio.load(page);

  const title = clean($page('td[bgcolor="#413E3E"] font[size="6"]').first().text()) || clean($page('title').text());
  const logoSrc = $page('img.spip_logo_right, img.spip_logo').filter((_, el) => /arton\d+/.test($page(el).attr('src') ?? '')).first().attr('src');
  const logo = logoSrc ? logoSrc.split('?')[0] : null;

  // Le gabarit d'origine est mal formé : on découpe le source entre le début du bloc et son commentaire de fin.
  const start = page.indexOf('class="itemtext"');
  let end = page.indexOf('<!-- itemtext -->', start);
  if (end < 0) end = page.indexOf('<!-- primary -->', start);
  const fragment = start < 0 ? '' : page.slice(page.indexOf('>', start) + 1, end < 0 ? undefined : end);
  const $ = cheerio.load(fragment, null, false);

  $(DROP).each((_, el) => {
    if ((el as Element).tagName === 'script') flags.push('script supprimé');
    $(el).remove();
  });

  $('*').each((_, node) => {
    const $el = $(node as Element);
    if (isHidden($el) && clean($el.text())) {
      flags.push(`bloc masqué supprimé : « ${clean($el.text()).slice(0, 80)} »`);
      $el.remove();
    }
  });

  // Lien vers une image du site (galerie Galleria, vignette cliquable) : on garde l'image elle-même, en grand.
  $('a[href]').each((_, el) => {
    const path = sitePath($(el).attr('href')!);
    if (!path || !/^IMG\/.+\.(jpe?g|png|gif)$/i.test(path)) return;
    const alt = ($(el).find('img').attr('alt') ?? '').trim();
    $(el).replaceWith($('<img>').attr('src', path).attr('alt', alt));
  });

  // Le logo d'article est repris à part ; les icônes de documents sont inutiles.
  $('img').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if ($(el).hasClass('spip_logo') || DOC_ICON.test(src)) $(el).remove();
  });

  $('a').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/^(javascript|data|vbscript):/i.test(href.trim())) {
      flags.push(`lien dangereux supprimé : ${href.slice(0, 60)}`);
      $(el).remove();
    } else if (/^https?:\/\//i.test(href) && !hostAllowed(href)) {
      flags.push(`lien externe à vérifier, retiré : ${href}`);
      $(el).replaceWith($(el).text());
    }
  });

  // « <p><strong>Titre</strong></p> » sert de sous-titre dans l'original.
  $('p').each((_, el) => {
    const $p = $(el);
    const only = $p.children('strong, b');
    if (only.length === 1 && clean($p.text()) && clean($p.text()) === clean(only.text())) {
      $p.replaceWith(`<h2>${only.html()}</h2>`);
    }
  });
  $('hr').remove();

  // Liste blanche : on ne garde que la structure du texte.
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type !== 'tag') continue;
      const el = node as Element;
      walk(el.children);
      const tag = el.tagName.toLowerCase();
      const $el = $(el);
      if (!KEEP.has(tag)) {
        $el.replaceWith($el.contents());
        continue;
      }
      for (const attr of Object.keys(el.attribs)) {
        if (!(tag === 'a' && attr === 'href') && !(tag === 'img' && (attr === 'src' || attr === 'alt'))) $el.removeAttr(attr);
      }
    }
  };
  walk($.root().children().toArray());

  $('p, li, h2, h3, h4, strong, b, em, i').each((_, el) => {
    const $el = $(el);
    if (!clean($el.text()) && !$el.find('img').length) $el.remove();
  });

  const pdfs = new Set<string>();
  const images = new Set<string>();
  const articleLinks = new Set<number>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')!;
    const path = sitePath(href);
    if (path && /^IMG\/pdf\/.+\.pdf$/i.test(path)) pdfs.add(path);
    const id = articleId(href);
    if (id) articleLinks.add(id);
  });
  $('img[src]').each((_, el) => {
    const path = sitePath($(el).attr('src')!);
    if (path) images.add(path);
  });

  return {
    title,
    html: $.html().trim(),
    logo,
    images: [...images],
    pdfs: [...pdfs],
    articleLinks: [...articleLinks],
    flags,
  };
}

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '_', strongDelimiter: '**' });

turndown.addRule('pdf-links', {
  filter: (node) => node.nodeName === 'A' && /IMG\/pdf\/[^"?#]+\.pdf/i.test(node.getAttribute('href') ?? ''),
  replacement: (content, node) => {
    const file = (node as HTMLElement).getAttribute('href')!.match(/IMG\/pdf\/([^"?#/]+\.pdf)/i)![1];
    return `[${content.trim()}](/documents/${file})`;
  },
});

export function toMarkdown(html: string): string {
  return turndown
    .turndown(html)
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
