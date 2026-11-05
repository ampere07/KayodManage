import React from 'react';

export type Tone = 'blue' | 'violet' | 'amber' | 'emerald' | 'red' | 'gray' | 'orange' | 'purple' | 'indigo' | 'yellow';

// Literal class names so Tailwind generates them. Colours match the row badges
// (job statuses, archive kinds, user account types and statuses).
const TONES: Record<Tone, { dot: string; selected: string; bar: string; pill: string }> = {
  blue: { dot: 'bg-blue-500', selected: 'bg-blue-50/70', bar: 'bg-blue-500', pill: 'bg-blue-500 border-blue-500' },
  violet: { dot: 'bg-violet-500', selected: 'bg-violet-50/70', bar: 'bg-violet-500', pill: 'bg-violet-500 border-violet-500' },
  amber: { dot: 'bg-amber-500', selected: 'bg-amber-50/70', bar: 'bg-amber-500', pill: 'bg-amber-500 border-amber-500' },
  emerald: { dot: 'bg-emerald-500', selected: 'bg-emerald-50/70', bar: 'bg-emerald-500', pill: 'bg-emerald-500 border-emerald-500' },
  red: { dot: 'bg-red-500', selected: 'bg-red-50/70', bar: 'bg-red-500', pill: 'bg-red-500 border-red-500' },
  gray: { dot: 'bg-gray-400', selected: 'bg-gray-100', bar: 'bg-gray-500', pill: 'bg-gray-500 border-gray-500' },
  orange: { dot: 'bg-orange-500', selected: 'bg-orange-50/70', bar: 'bg-orange-500', pill: 'bg-orange-500 border-orange-500' },
  purple: { dot: 'bg-purple-500', selected: 'bg-purple-50/70', bar: 'bg-purple-500', pill: 'bg-purple-500 border-purple-500' },
  indigo: { dot: 'bg-indigo-500', selected: 'bg-indigo-50/70', bar: 'bg-indigo-500', pill: 'bg-indigo-500 border-indigo-500' },
  yellow: { dot: 'bg-yellow-500', selected: 'bg-yellow-50/70', bar: 'bg-yellow-500', pill: 'bg-yellow-500 border-yellow-500' },
};

export interface Counter {
  key: string;
  label: string;
  /** Used below xl, where the full label would be cut off. */
  shortLabel?: string;
  /** What the number means, shown on hover. */
  hint: string;
  count?: number;
  tone: Tone;
  selected: boolean;
  onClick: () => void;
  /** Quick filters: the number turns their colour while anything needs a look. */
  alert?: boolean;
  /** A second figure beside the number, from xl (short form below 2xl). */
  extra?: { full: string; short: string };
}

export interface CounterGroup {
  label: string;
  /** Shown beside the label, e.g. "Active · 20". */
  total?: number;
  cells: Counter[];
}

const shown = (n?: number) => (n === undefined ? '–' : n.toLocaleString());
const numberTone = (cell: Counter) =>
  cell.alert && cell.count ? (cell.tone === 'red' ? 'text-red-600' : 'text-amber-600') : cell.alert ? 'text-gray-300' : 'text-gray-900';

/**
 * Counters that are also filters, in the Users page's style: labelled groups,
 * each one white card split into cells. Each number is the rows that clicking
 * it shows; the selected cell is tinted and underlined. Phones get the same
 * counters as a row of pills, led by an All pill. With `allCell`, desktop
 * leads with an All counter too, in a "Total" group of its own: selected while
 * no counter filter is, and clicking it lifts them all.
 */
const CounterGroups: React.FC<{
  groups: CounterGroup[];
  /** The desktop grid's columns, one per group (a literal Tailwind class). */
  gridClass: string;
  all: { count?: number; selected: boolean; onClick: () => void };
  filtered: boolean;
  onClear: () => void;
  testId: string;
  /** Test ids are `<prefix>-count-<key>` (desktop) and `<prefix>-pill-<key>` (phones). */
  idPrefix?: string;
  /** Lead the desktop counters with an All cell (the grid needs a column for it). */
  allCell?: { label: string; shortLabel?: string; hint: string };
}> = ({ groups, gridClass, all, filtered, onClear, testId, idPrefix = 'jobs', allCell }) => {
  const desktopGroups: CounterGroup[] = allCell
    ? [{
        label: 'Total',
        cells: [{ key: 'all', tone: 'blue', ...allCell, count: all.count, selected: all.selected, onClick: all.onClick }],
      }, ...groups]
    : groups;

  return (
  <>
    {/* Phones and tablets: the same counters as a row of pills. */}
    <div className="lg:hidden -mx-4 px-4 pb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        data-testid={`${idPrefix}-pill-all`}
        aria-pressed={all.selected}
        onClick={all.onClick}
        className={`flex items-center gap-1 py-1.5 px-3 rounded-full border whitespace-nowrap transition-all active:scale-95 ${all.selected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-200 text-gray-600'}`}
      >
        <span className="text-[11px] font-black">{shown(all.count)}</span>
        <span className={`text-[9px] font-black uppercase tracking-wide ${all.selected ? 'text-white/80' : 'text-gray-400'}`}>All</span>
      </button>
      {groups.flatMap((group) => group.cells).map((cell) => (
        <button
          key={cell.key}
          type="button"
          data-testid={`${idPrefix}-pill-${cell.key}`}
          aria-pressed={cell.selected}
          onClick={cell.onClick}
          className={`flex items-center gap-1 py-1.5 px-3 rounded-full border whitespace-nowrap transition-all active:scale-95 ${cell.selected ? `${TONES[cell.tone].pill} text-white` : 'bg-white border-gray-200 text-gray-600'}`}
        >
          <span className={`text-[11px] font-black ${cell.selected ? '' : cell.alert && cell.count ? numberTone(cell) : ''}`}>{shown(cell.count)}</span>
          <span className={`text-[9px] font-black uppercase tracking-wide ${cell.selected ? 'text-white/80' : 'text-gray-400'}`}>{cell.label}</span>
        </button>
      ))}
    </div>

    {/* Desktop: grouped counters. */}
    <div className={`hidden lg:grid ${gridClass} gap-3 xl:gap-4 pb-5`} data-testid={testId}>
      {desktopGroups.map((group, index) => (
        <div key={group.label} className="min-w-0">
          <div className="flex items-center justify-between h-4 mb-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {group.label}
              {group.total !== undefined && <span className="text-gray-500"> · {group.total.toLocaleString()}</span>}
            </span>
            {index === desktopGroups.length - 1 && filtered && (
              <button
                type="button"
                onClick={onClear}
                className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-100">
            {group.cells.map((cell) => {
              const disabled = cell.alert && !cell.count && !cell.selected;
              return (
                <button
                  key={cell.key}
                  type="button"
                  data-testid={`${idPrefix}-count-${cell.key}`}
                  aria-pressed={cell.selected}
                  title={cell.hint}
                  disabled={disabled}
                  onClick={cell.onClick}
                  className={`relative flex-1 min-w-0 px-2 xl:px-3.5 py-2.5 text-left transition-colors disabled:cursor-default ${cell.selected ? TONES[cell.tone].selected : disabled ? '' : 'hover:bg-gray-50'}`}
                >
                  <span className={`flex items-center gap-1.5 text-[10px] xl:text-[11px] font-semibold truncate ${cell.selected ? 'text-gray-900' : 'text-gray-500'}`}>
                    <span className={`hidden xl:inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${TONES[cell.tone].dot}`} />
                    {cell.shortLabel ? (
                      <>
                        <span className="truncate xl:hidden">{cell.shortLabel}</span>
                        <span className="truncate hidden xl:inline">{cell.label}</span>
                      </>
                    ) : (
                      <span className="truncate">{cell.label}</span>
                    )}
                  </span>
                  <span className="mt-1 flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-2xl font-black leading-none tabular-nums ${numberTone(cell)}`}>{shown(cell.count)}</span>
                    {cell.extra && (
                      <span className="hidden xl:inline text-[11px] font-bold text-emerald-600 truncate">
                        <span className="2xl:hidden">{cell.extra.short}</span>
                        <span className="hidden 2xl:inline">{cell.extra.full}</span>
                      </span>
                    )}
                  </span>
                  {cell.selected && <span className={`absolute inset-x-0 bottom-0 h-[3px] ${TONES[cell.tone].bar}`} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </>
  );
};

export default CounterGroups;
