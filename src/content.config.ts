import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { documentsSchema, evenementSchema, pageSchema, sortieSchema } from './lib/schemas';

export { sections } from './lib/schemas';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: ({ image }) => pageSchema(image),
});

const evenements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/evenements' }),
  schema: evenementSchema,
});

const sorties = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sorties' }),
  schema: ({ image }) => sortieSchema(image),
});

const documents = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/documents' }),
  schema: documentsSchema,
});

export const collections = { pages, evenements, sorties, documents };
