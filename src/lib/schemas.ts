import { z } from 'astro/zod';

/** Rubriques du site. Pas de forum : il n'est volontairement pas recréé. */
export const sections = [
  'vie-du-club',
  'almanach',
  'routracs',
  'photo-du-mois',
  'mains-sales',
  'de-34-a-57',
  'infos',
] as const;
export type Section = (typeof sections)[number];

/** Signature de l'helper `image()` fourni par Astro aux schémas de collection. */
type ImageHelper = () => z.ZodType;

export const pageSchema = (image: ImageHelper) =>
  z.object({
    title: z.string().min(1),
    section: z.enum(sections),
    order: z.number().int(),
    description: z.string().min(1),
    /** Anciens numéros d'article SPIP, pour les redirections 301. */
    legacyIds: z.array(z.number().int().positive()).default([]),
    /** Anciens numéros de rubrique SPIP. */
    legacyRubriques: z.array(z.number().int().positive()).default([]),
    cover: image().optional(),
  });

export const evenementSchema = z
  .object({
    title: z.string().min(1),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    place: z.string().optional(),
    link: z.url().optional(),
  })
  .refine((e) => !e.end || e.end >= e.start, {
    message: 'La date de fin doit être postérieure ou égale à la date de début.',
    path: ['end'],
  });

export const sortieSchema = (image: ImageHelper) =>
  z.object({
    title: z.string().min(1),
    kind: z.enum(['almanach', 'routracs']).default('almanach'),
    year: z.number().int().min(2000).max(2100),
    date: z.coerce.date().optional(),
    place: z.string().optional(),
    cover: image(),
    gallery: z.array(z.object({ src: image(), alt: z.string().min(1) })).default([]),
  });

export const documentsSchema = z.object({
  category: z.string().min(1),
  items: z.array(
    z.object({
      title: z.string().min(1),
      file: z.string().regex(/^\/documents\/[^/]+\.pdf$/, 'Le fichier doit être un PDF dans /documents/.'),
      thumb: z.string().optional(),
      sizeKb: z.number().positive().optional(),
    }),
  ),
});
