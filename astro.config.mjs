// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rehypeContent } from './src/lib/rehype-content.ts';
import { obfuscateEmailsIntegration } from './src/lib/obfuscate-emails.ts';

export default defineConfig({
  site: 'https://la-traction-de-provence.fr',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Pas de CSS ni de JS en ligne : la CSP n'autorise que 'self'.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  markdown: {
    // Pas de coloration de code : elle ajoute des styles en ligne, interdits par la CSP.
    syntaxHighlight: false,
    rehypePlugins: [rehypeContent],
  },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') }), obfuscateEmailsIntegration()],
});
