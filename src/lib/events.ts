const DAY_MS = 24 * 60 * 60 * 1000;

const parisFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Jour calendaire à Paris, au format AAAA-MM-JJ (comparable comme une chaîne). */
export function parisDay(date: Date): string {
  return parisFormat.format(date);
}

type Dated = { start: Date; end?: Date };

/**
 * Événements à venir ou en cours : fin (ou début) au plus tôt aujourd'hui,
 * début au plus tard dans `days` jours. Jours calculés à l'heure de Paris.
 */
export function upcomingEvents<T extends Dated>(events: T[], now: Date, days = 30): T[] {
  const today = parisDay(now);
  const limit = parisDay(new Date(now.getTime() + days * DAY_MS));
  return events
    .filter((e) => parisDay(e.end ?? e.start) >= today && parisDay(e.start) <= limit)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
