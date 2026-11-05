// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
