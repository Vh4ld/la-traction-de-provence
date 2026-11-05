import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const toEntities = (text: string) => [...text].map((c) => `&#${c.codePointAt(0)};`).join('');

/**
 * Masque les adresses électroniques du HTML généré : les liens « mailto: » et les adresses écrites
 * en clair sont encodés en entités HTML. Le navigateur affiche la même chose, mais les robots qui
 * collectent les adresses dans le code source ne les reconnaissent pas. Scripts et styles intacts.
 */
export function obfuscateEmails(html: string): string {
  let raw: string | null = null; // balise script/style ouverte
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        const tag = part.match(/^<\/?([a-z]+)/i)?.[1]?.toLowerCase();
        if (raw) {
          if (part.toLowerCase() === `</${raw}>`) raw = null;
          return part;
        }
        if ((tag === 'script' || tag === 'style') && !part.startsWith('</')) raw = tag;
        return part.replace(/href="(mailto:[^"]+)"/gi, (_, href: string) => `href="${toEntities(href)}"`);
      }
      return raw ? part : part.replace(EMAIL, toEntities);
    })
    .join('');
}

/** Intégration Astro : applique `obfuscateEmails` à toutes les pages une fois la compilation terminée. */
export function obfuscateEmailsIntegration(): AstroIntegration {
  return {
    name: 'masquer-adresses',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        let count = 0;
        const walk = async (d: string): Promise<void> => {
          for (const entry of await readdir(d, { withFileTypes: true })) {
            const p = join(d, entry.name);
            if (entry.isDirectory()) await walk(p);
            else if (entry.name.endsWith('.html')) {
              const html = await readFile(p, 'utf8');
              const out = obfuscateEmails(html);
              if (out !== html) {
                await writeFile(p, out);
                count++;
              }
            }
          }
        };
        await walk(root);
        logger.info(`adresses masquées dans ${count} page(s)`);
      },
    },
  };
}
