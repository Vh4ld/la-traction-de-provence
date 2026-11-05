import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { evenementSchema, pageSchema } from './lib/schemas';

export { sections } from './lib/schemas';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: ({ image }) => pageSchema(image),
});

const evenements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/evenements' }),
  schema: evenementSchema,
});



export const collections = { pages, evenements };
