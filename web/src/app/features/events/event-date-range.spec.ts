import { eventOccursOnLocalDay } from './event-date-range';

describe('eventOccursOnLocalDay', () => {
  it('shows a three-day event on its start, middle and end days', () => {
    const start = '2026-11-20T09:00:00';
    const end = '2026-11-22T18:00:00';
    expect(eventOccursOnLocalDay(start, end, new Date(2026, 10, 19))).toBe(false);
    expect(eventOccursOnLocalDay(start, end, new Date(2026, 10, 20))).toBe(true);
    expect(eventOccursOnLocalDay(start, end, new Date(2026, 10, 21))).toBe(true);
    expect(eventOccursOnLocalDay(start, end, new Date(2026, 10, 22))).toBe(true);
    expect(eventOccursOnLocalDay(start, end, new Date(2026, 10, 23))).toBe(false);
  });

  it('keeps a single-day event on its start date when end date is absent', () => {
    expect(eventOccursOnLocalDay('2026-11-20T09:00:00', undefined, new Date(2026, 10, 20))).toBe(true);
    expect(eventOccursOnLocalDay('2026-11-20T09:00:00', undefined, new Date(2026, 10, 21))).toBe(false);
  });

  it('handles events spanning two months', () => {
    expect(eventOccursOnLocalDay('2026-11-30T14:00:00', '2026-12-02T14:00:00', new Date(2026, 11, 1))).toBe(true);
    expect(eventOccursOnLocalDay('2026-11-30T14:00:00', '2026-12-02T14:00:00', new Date(2026, 11, 3))).toBe(false);
  });

  it('ignores invalid starts and does not extend a reversed range', () => {
    expect(eventOccursOnLocalDay('invalid', undefined, new Date(2026, 10, 20))).toBe(false);
    expect(eventOccursOnLocalDay('2026-11-20T09:00:00', '2026-11-19T09:00:00', new Date(2026, 10, 19))).toBe(false);
  });
});
