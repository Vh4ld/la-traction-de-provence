// @vitest-environment happy-dom
import { describe, expect, test, beforeEach } from 'vitest';
import { hidePastEvents } from '../../src/scripts/events';

beforeEach(() => {
  document.body.innerHTML = `
    <section>
      <ul>
        <li data-event-end="2026-06-21">Hier</li>
        <li data-event-end="2026-06-22">Aujourd’hui</li>
      </ul>
      <p data-events-empty hidden>Aucun événement prévu pour le moment.</p>
    </section>`;
});

const items = () => Array.from(document.querySelectorAll<HTMLElement>('[data-event-end]'));
const empty = () => document.querySelector<HTMLElement>('[data-events-empty]')!;

describe('hidePastEvents', () => {
  test('masque les événements terminés avant aujourd’hui (heure de Paris)', () => {
    hidePastEvents(document, new Date('2026-06-22T08:00:00+02:00'));
    expect(items().map((li) => li.hidden)).toEqual([true, false]);
    expect(empty().hidden).toBe(true);
  });

  test('affiche le message quand tout est passé', () => {
    hidePastEvents(document, new Date('2026-06-23T00:30:00+02:00'));
    expect(items().every((li) => li.hidden)).toBe(true);
    expect(empty().hidden).toBe(false);
  });
});
