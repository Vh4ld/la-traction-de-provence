import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';

/** Taille lisible en français : « 177 Ko », « 1,1 Mo », « 20 Mo ». */
export function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} Ko`;
  const mb = kb / 1024;
  const rounded = mb >= 10 ? Math.round(mb).toString() : mb.toFixed(1).replace('.', ',').replace(/,0$/, '');
  return `${rounded} Mo`;
}

const isWhitespace = (n: ElementContent) => n.type === 'text' && !n.value.trim();
const isImage = (n: ElementContent): boolean =>
  n.type === 'element' && (n.tagName === 'img' || (n.tagName === 'a' && n.children.some((c) => isImage(c)) && n.children.every((c) => isImage(c) || isWhitespace(c))));

/**
 * Images responsives (traitées ensuite par Astro, qui lit ces propriétés).
 * La dernière largeur dépasse toute image : Astro la remplace alors par la largeur
 * de l'original, qui reste ainsi toujours disponible pour la visionneuse.
 */
const ORIGINAL = 10_000;
// Vignettes de galerie : grille de colonnes d'au moins 9rem (voir .gallery dans global.css).
// Au-delà de 21rem de large, il y a au moins deux colonnes : une vignette fait au plus ~14rem ;
// à partir de 56rem, au moins trois (même à côté de la couverture) : au plus ~12,5rem.
export const GALLERY_SIZES = '(min-width: 56rem) 12.5rem, (min-width: 21rem) 14rem, 100vw';
export const GALLERY_WIDTHS = [240, 480, 720, ORIGINAL];
// Image dans le texte : au plus la largeur de lecture (70ch, moins de 48rem).
export const PROSE_SIZES = '(min-width: 50rem) 48rem, calc(100vw - 2rem)';
export const PROSE_WIDTHS = [480, 800, 1200, 1600, ORIGINAL];

const setResponsive = (node: ElementContent, sizes: string, widths: number[]) => {
  if (node.type !== 'element') return;
  if (node.tagName === 'img') {
    // `widths` est une option d'Astro (tableau de nombres), pas un attribut HTML : hast le type à tort en texte.
    Object.assign(node.properties, { sizes, widths });
    return;
  }
  node.children.forEach((c) => setResponsive(c, sizes, widths));
};

const pdfHref = (el: Element) => {
  const href = String(el.properties?.href ?? '');
  return /^\/documents\/[^/]+\.pdf$/i.test(href) ? href : null;
};

/**
 * Mise en forme du contenu Markdown :
 * - un paragraphe fait uniquement d'images (au moins deux) devient une galerie ;
 * - chaque image reçoit des largeurs et un `sizes` adaptés à sa place (vignette ou texte) ;
 * - un lien texte vers un PDF reçoit la classe `doc-link` et l'indication « PDF, taille ».
 */
export function rehypeContent(options: { publicDir?: string } = {}) {
  const publicDir = options.publicDir ?? 'public';
  return (tree: Root) => {
    visit(tree, 'element', (el: Element) => {
      if (el.tagName === 'p') {
        const meaningful = el.children.filter((c) => !isWhitespace(c));
        if (meaningful.length >= 2 && meaningful.every(isImage)) {
          el.tagName = 'div';
          el.properties = { ...el.properties, className: ['gallery'] };
          el.children = meaningful;
          meaningful.forEach((c) => setResponsive(c, GALLERY_SIZES, GALLERY_WIDTHS));
        }
        return;
      }
      if (el.tagName === 'img') {
        if (!el.properties?.sizes) setResponsive(el, PROSE_SIZES, PROSE_WIDTHS);
        return;
      }
      if (el.tagName !== 'a') return;
      const pdf = pdfHref(el);
      if (!pdf || el.children.some(isImage)) return;
      let size = '';
      try {
        size = `, ${formatSize(statSync(join(publicDir, decodeURIComponent(pdf))).size)}`;
      } catch {
        // Fichier absent : la vérification des liens le signalera.
      }
      el.properties = { ...el.properties, className: ['doc-link'] };
      el.children.push({ type: 'element', tagName: 'span', properties: { className: ['doc-meta'] }, children: [{ type: 'text', value: ` (PDF${size})` }] });
    });
  };
}
