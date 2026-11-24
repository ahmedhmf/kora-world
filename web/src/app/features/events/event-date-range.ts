/**
 * Calendar entries are displayed on each local calendar day touched by their
 * inclusive start/end dates. This does not create additional event records.
 */
export function eventOccursOnLocalDay(
  startDate: string,
  endDate: string | undefined | null,
  day: Date,
): boolean {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(day.getTime())) return false;

  const endCandidate = endDate ? new Date(endDate) : start;
  const end = Number.isNaN(endCandidate.getTime()) || endCandidate < start
    ? start
    : endCandidate;

  const atLocalMidnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const target = atLocalMidnight(day);
  return target >= atLocalMidnight(start) && target <= atLocalMidnight(end);
}
