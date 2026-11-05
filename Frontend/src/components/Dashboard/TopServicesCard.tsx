import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from 'recharts';
import { useJobCategories } from '../../hooks/useJobs';
import { getProfessionIconByName } from '../../constants/categoryIcons';
import type { DashboardOverview, ServicePeriod } from '../../types/dashboard.types';
import type { JobCategory } from '../../types/configuration.types';
import { Segmented } from './EarningsCard';
import { change } from './dashboardFormat';

// One colour per rank: the slice, its row dot and its icon tile match.
const RANK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const OTHER_COLOR = '#e2e8f0';
const PERIODS: [ServicePeriod, string][] = [['7d', '7D'], ['30d', '30D'], ['90d', '90D']];

interface Slice {
  name: string;
  count: number;
  previous: number;
  color: string;
  icon: string;
  category: string;
  share: number;
  other?: boolean;
}

/** A service's icon and the category it sits in (same icon rule as the Jobs table). */
const describe = (name: string, categories: JobCategory[]) => {
  const wanted = name.toLowerCase();
  for (const category of categories) {
    if (category.name.toLowerCase() === wanted) {
      return { icon: getProfessionIconByName('', category.icon || '').imagePath, category: '' };
    }
    const profession = category.professions?.find((p) => p.name.toLowerCase() === wanted);
    if (profession) {
      return { icon: getProfessionIconByName(profession.icon || '', category.icon || '').imagePath, category: category.name };
    }
  }
  return { icon: '', category: '' };
};

/** "▲ 2", "▼ 1", "new" or "–": the change in jobs on the period before. */
const Trend: React.FC<{ count: number; previous: number }> = ({ count, previous }) => {
  const diff = count - previous;
  if (previous === 0 && count > 0) return <span className="text-[11px] font-semibold text-emerald-600">new</span>;
  if (diff === 0) return <span className="text-[11px] text-gray-400">–</span>;
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
    </span>
  );
};

/** The hovered or pinned slice, pulled out a little. */
const ActiveSlice = (props: any) => (
  <Sector {...props} outerRadius={props.outerRadius + 5} cornerRadius={4} />
);

const TopServicesCard: React.FC<{ topServices: DashboardOverview['topServices'] }> = ({ topServices }) => {
  const { categories } = useJobCategories();
  const [period, setPeriod] = useState<ServicePeriod>('30d');
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  // An older backend (before the 7/30/90-day periods) sends no periods: show
  // a quiet note instead of breaking the whole Dashboard.
  const demand = topServices?.[period] ?? { days: 0, posted: 0, previousPosted: 0, items: [] };
  const unavailable = !topServices?.[period];

  const slices = useMemo<Slice[]>(() => {
    const top = demand.items.map((item, i) => ({
      ...item,
      ...describe(item.name, categories || []),
      color: RANK_COLORS[i % RANK_COLORS.length],
      share: demand.posted ? Math.round((item.count / demand.posted) * 100) : 0,
    }));
    const rest = demand.posted - top.reduce((n, s) => n + s.count, 0);
    const restBefore = demand.previousPosted - top.reduce((n, s) => n + s.previous, 0);
    return rest > 0
      ? [...top, { name: 'Other services', count: rest, previous: Math.max(0, restBefore), color: OTHER_COLOR, icon: '', category: '', share: Math.round((rest / demand.posted) * 100), other: true }]
      : top;
  }, [demand, categories]);

  const active = hovered ?? pinned;
  const focus = active !== null ? slices[active] : null;
  const overall = change(demand.posted, demand.previousPosted);
  const choosePeriod = (p: ServicePeriod) => { setPeriod(p); setHovered(null); setPinned(null); };
  const togglePin = (i: number) => setPinned((p) => (p === i ? null : i));

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 tight:p-4 flex flex-col h-full min-h-0" data-testid="dashboard-most-requested">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900">Most requested</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate compact:hidden">Jobs posted by service · hover or click a slice</p>
        </div>
        <Segmented value={period} onChange={choosePeriod} options={PERIODS} />
      </div>

      {unavailable ? (
        <p className="flex-1 flex items-center justify-center text-sm text-gray-500 py-6">This chart couldn't load. Try Refresh.</p>
      ) : demand.posted === 0 ? (
        <p className="flex-1 flex items-center justify-center text-sm text-gray-500 py-6">No jobs posted in the last {demand.days} days.</p>
      ) : (
        <div className="mt-3 compact:mt-2 flex-1 min-h-0 flex items-center gap-4 compact:gap-3">
          {/* The donut is square: as wide as it is tall when fitting the window. */}
          <div className="relative flex-shrink-0 w-36 h-36 sm:w-40 sm:h-40 fit:w-auto fit:h-full fit:max-h-[220px] fit:max-w-[40%] aspect-square" onMouseLeave={() => setHovered(null)}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="88%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  cornerRadius={4}
                  stroke="none"
                  activeIndex={active ?? undefined}
                  activeShape={ActiveSlice}
                  onMouseEnter={(_, i) => setHovered(i)}
                  onClick={(_, i) => togglePin(i)}
                  animationDuration={500}
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.name}
                      fill={s.color}
                      fillOpacity={active === null || active === i ? 1 : 0.3}
                      style={{ cursor: 'pointer', outline: 'none', transition: 'fill-opacity 150ms' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Centre: the hovered service, or the period's total. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-[22%]">
              {focus ? (
                <>
                  <span className="text-[10px] tight:text-[9px] font-semibold text-gray-500 leading-tight line-clamp-2">{focus.name}</span>
                  <span className="text-xl tight:text-lg font-bold text-gray-900 leading-tight tabular-nums">{focus.share}%</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{focus.count} {focus.count === 1 ? 'job' : 'jobs'}</span>
                </>
              ) : (
                <>
                  <span className="text-2xl tight:text-xl font-bold text-gray-900 leading-none tabular-nums">{demand.posted}</span>
                  <span className="mt-0.5 text-[10px] text-gray-500 leading-tight">jobs posted</span>
                  {overall.percent !== null && overall.direction !== 'flat' && (
                    <span className={`mt-0.5 text-[10px] font-semibold ${overall.direction === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {overall.direction === 'up' ? '▲' : '▼'} {overall.percent}%
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Rows that don't fit wrap into a second column, which overflow
              hides, so a short card shows fewer whole rows, never squashed ones. */}
          <ul className="flex-1 min-w-0 self-stretch overflow-hidden flex flex-col flex-wrap content-start justify-center" onMouseLeave={() => setHovered(null)}>
            {slices.map((s, i) => {
              const dimmed = active !== null && active !== i;
              return (
                <li key={s.name} className="w-full">
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(i)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    onClick={() => togglePin(i)}
                    aria-pressed={pinned === i}
                    className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1.5 compact:py-1 tight:py-0.5 text-left transition-all ${active === i ? 'bg-gray-50' : ''} ${dimmed ? 'opacity-45' : ''}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.other ? '#cbd5e1' : s.color }} />
                    <span className="hidden sm:flex xl:hidden 2xl:flex w-6 h-6 rounded-md items-center justify-center flex-shrink-0" style={{ backgroundColor: s.other ? '#f1f5f9' : `${s.color}1f` }}>
                      {s.icon ? <img src={s.icon} alt="" className="w-4 h-4 object-contain" /> : <span className="text-[10px] font-bold text-gray-400">{s.other ? '…' : s.name.charAt(0)}</span>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm truncate ${s.other ? 'text-gray-500' : 'font-medium text-gray-900'}`} title={s.name}>{s.name}</span>
                      {s.category && <span className="block text-[11px] text-gray-500 truncate compact:hidden">{s.category}</span>}
                    </span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">{s.count}</span>
                    <span className="w-7 text-right flex-shrink-0"><Trend count={s.count} previous={s.previous} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default TopServicesCard;
