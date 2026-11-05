import { parisDay } from '../lib/events';

/**
 * Le site est statique : un événement passé depuis la dernière compilation
 * resterait affiché. On le masque donc aussi dans le navigateur.
 */
export function hidePastEvents(root: ParentNode, now: Date): void {
  const today = parisDay(now);
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-event-end]'));
  items.forEach((item) => {
    item.hidden = (item.dataset.eventEnd ?? '') < today;
  });
  const empty = root.querySelector<HTMLElement>('[data-events-empty]');
  if (empty) empty.hidden = items.some((item) => !item.hidden);
}
