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

/** `image` : l'helper fourni par Astro aux schémas de collection (générique pour garder le type des images). */
export const pageSchema = <T extends z.ZodType>(image: () => T) =>
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
    /** Lien externe : https uniquement (pas de javascript:, data:, http:…). */
    link: z.url({ protocol: /^https$/ }).optional(),
  })
  .refine((e) => !e.end || e.end >= e.start, {
    message: 'La date de fin doit être postérieure ou égale à la date de début.',
    path: ['end'],
  });
