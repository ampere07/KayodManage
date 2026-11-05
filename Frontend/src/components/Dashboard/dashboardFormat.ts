import { formatDistanceToNowStrict } from 'date-fns';

/** ₱55,700 — whole pesos; cents add nothing at dashboard scale. */
export const peso = (value: number) =>
  `₱${Math.round(value).toLocaleString('en-PH')}`;

/** ₱55.7k on chart axes, where width is tight. */
export const pesoShort = (value: number) =>
  value >= 1_000_000 ? `₱${(value / 1_000_000).toFixed(1)}M`
    : value >= 1000 ? `₱${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
      : `₱${Math.round(value)}`;

export interface Change {
  /** Whole percent, or null when there is nothing earlier to compare with. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** How `current` compares with `previous`. */
export const change = (current: number, previous: number): Change => {
  if (previous === 0) return { percent: null, direction: current > 0 ? 'up' : 'flat' };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { percent: Math.abs(percent), direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat' };
};

/** "3 days", "7 months" — how long the oldest item has waited. */
export const waitedFor = (since: string | null) =>
  since ? formatDistanceToNowStrict(new Date(since)) : '';

/** Parse "YYYY-MM-DD" / "YYYY-MM" as a local calendar date (no UTC shift). */
export const calendarDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const sumOf = <T,>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);
