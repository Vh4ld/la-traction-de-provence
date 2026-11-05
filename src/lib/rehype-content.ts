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

const pdfHref = (el: Element) => {
  const href = String(el.properties?.href ?? '');
  return /^\/documents\/[^/]+\.pdf$/i.test(href) ? href : null;
};

/**
 * Mise en forme du contenu Markdown :
 * - un paragraphe fait uniquement d'images (au moins deux) devient une galerie ;
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
        }
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
