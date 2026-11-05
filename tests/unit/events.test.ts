import { describe, expect, test } from 'vitest';
import { upcomingEvents, parisDay } from '../../src/lib/events';

// Lundi 22 juin 2026, 10 h à Paris.
const now = new Date('2026-06-22T10:00:00+02:00');
const ev = (title: string, start: string, end?: string) => ({
  title,
  start: new Date(start),
  end: end ? new Date(end) : undefined,
});

describe('upcomingEvents', () => {
  test('garde un événement de plusieurs jours en cours', () => {
    const r = upcomingEvents([ev('N9', '2026-06-21', '2026-06-23')], now);
    expect(r.map((e) => e.title)).toEqual(['N9']);
  });

  test('écarte un événement terminé la veille', () => {
    expect(upcomingEvents([ev('hier', '2026-06-20')], now)).toEqual([]);
  });

  test('garde un événement du jour même commencé à minuit', () => {
    expect(upcomingEvents([ev('ce jour', '2026-06-22T00:00:00+02:00')], now)).toHaveLength(1);
  });

  test('limite à 30 jours par défaut', () => {
    const r = upcomingEvents([ev('21 juillet', '2026-07-21'), ev('23 juillet', '2026-07-23')], now);
    expect(r.map((e) => e.title)).toEqual(['21 juillet']);
  });

  test('trie par date de début', () => {
    const r = upcomingEvents([ev('b', '2026-07-01'), ev('a', '2026-06-25')], now);
    expect(r.map((e) => e.title)).toEqual(['a', 'b']);
  });

  test('le jour est calculé à l’heure de Paris, pas en UTC', () => {
    // 23 h 30 à Paris le 22 = 21 h 30 UTC : on est encore le 22 juin.
    const lateEvening = new Date('2026-06-22T23:30:00+02:00');
    expect(upcomingEvents([ev('ce jour', '2026-06-22')], lateEvening)).toHaveLength(1);
    expect(parisDay(new Date('2026-06-22T23:30:00+02:00'))).toBe('2026-06-22');
    expect(parisDay(new Date('2026-06-23T00:30:00+02:00'))).toBe('2026-06-23');
  });
});
