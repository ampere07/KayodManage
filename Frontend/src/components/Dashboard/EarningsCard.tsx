import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DashboardDay, DashboardMonth } from '../../types/dashboard.types';
import { calendarDate, change, peso, pesoShort, sumOf } from './dashboardFormat';

type Metric = 'fees' | 'jobValue';
type Range = '7d' | '30d' | '12m';

const METRICS: Record<Metric, { label: string; color: string; countLabel: (n: number) => string }> = {
  fees: { label: 'Platform fees', color: '#3b82f6', countLabel: (n) => `${n} ${n === 1 ? 'fee' : 'fees'} collected` },
  jobValue: { label: 'Job value', color: '#10b981', countLabel: (n) => `${n} ${n === 1 ? 'job' : 'jobs'} completed` },
};
const RANGES: Record<Range, { label: string; comparedWith: string; unit: string }> = {
  '7d': { label: '7 days', comparedWith: 'previous 7 days', unit: 'day' },
  '30d': { label: '30 days', comparedWith: 'previous 30 days', unit: 'day' },
  '12m': { label: '12 months', comparedWith: 'previous 12 months', unit: 'month' },
};
const PREVIOUS_COLOR = '#94a3b8';

interface Point {
  label: string;
  fullLabel: string;
  value: number;
  count: number;
  /** The same position in the period before, e.g. 30 days earlier. */
  previous: number;
  previousLabel: string;
}

/** Two-to-four option switch, the same look as the other pages' toggles. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center bg-gray-50 rounded-full p-1 border border-gray-100">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 tight:px-2 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${value === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Hover readout: this period's value against the same point of the period before. */
const ChartTooltip = ({ active, payload, metric, showPrevious }: any) => {
  if (!active || !payload?.length) return null;
  const point: Point = payload[0].payload;
  const { color, countLabel } = METRICS[metric as Metric];
  const delta = change(point.value, point.previous);
  return (
    <div className="bg-white/95 backdrop-blur px-3 py-2.5 border border-gray-200 rounded-xl shadow-lg min-w-[180px]">
      <p className="text-[11px] font-semibold text-gray-500">{point.fullLabel}</p>
      <div className="mt-1.5 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          This period
        </span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">{peso(point.value)}</span>
      </div>
      <p className="pl-3.5 text-[11px] text-gray-500">{countLabel(point.count)}</p>
      {showPrevious && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2 rounded-sm border border-dashed" style={{ borderColor: PREVIOUS_COLOR, backgroundColor: '#e2e8f0' }} />
            {point.previousLabel}
          </span>
          <span className="text-xs font-semibold text-gray-600 tabular-nums">{peso(point.previous)}</span>
        </div>
      )}
      {showPrevious && delta.percent !== null && delta.direction !== 'flat' && (
        <p className={`mt-1 text-[11px] font-semibold ${delta.direction === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
          {delta.direction === 'up' ? '▲' : '▼'} {delta.percent}% on the period before
        </p>
      )}
    </div>
  );
};

const EarningsCard: React.FC<{ daily: DashboardDay[]; monthly: DashboardMonth[] }> = ({ daily, monthly }) => {
  const [metric, setMetric] = useState<Metric>('fees');
  const [range, setRange] = useState<Range>('30d');
  const [showPrevious, setShowPrevious] = useState(true);

  const { points, total, count, previousTotal } = useMemo(() => {
    const countOf = (row: { feeCount: number; jobsCompleted: number }) => (metric === 'fees' ? row.feeCount : row.jobsCompleted);
    if (range === '12m') {
      const current = monthly.slice(-12);
      const before = monthly.slice(-24, -12);
      return {
        points: current.map((m, i): Point => ({
          label: format(calendarDate(m.month), 'MMM'),
          fullLabel: format(calendarDate(m.month), 'MMMM yyyy'),
          value: m[metric], count: countOf(m),
          previous: before[i]?.[metric] || 0,
          previousLabel: before[i] ? format(calendarDate(before[i].month), 'MMM yyyy') : '',
        })),
        total: sumOf(current, (m) => m[metric]),
        count: sumOf(current, countOf),
        previousTotal: sumOf(before, (m) => m[metric]),
      };
    }
    const n = range === '7d' ? 7 : 30;
    const current = daily.slice(-n);
    const before = daily.slice(-2 * n, -n);
    return {
      points: current.map((d, i): Point => ({
        label: format(calendarDate(d.date), 'MMM d'),
        fullLabel: format(calendarDate(d.date), 'EEEE, MMM d'),
        value: d[metric], count: countOf(d),
        previous: before[i]?.[metric] || 0,
        previousLabel: before[i] ? format(calendarDate(before[i].date), 'MMM d') : '',
      })),
      total: sumOf(current, (d) => d[metric]),
      count: sumOf(current, countOf),
      previousTotal: sumOf(before, (d) => d[metric]),
    };
  }, [daily, monthly, metric, range]);

  const delta = change(total, previousTotal);
  const { color } = METRICS[metric];
  const best = points.reduce<Point | null>((top, p) => (p.value > (top?.value || 0) ? p : top), null);
  const gradientId = `earnings-fill-${metric}`;

  // The range's total and its change; `inline` is the smaller copy that sits
  // beside the title on short windows.
  const summary = (inline: boolean) => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`${inline ? 'text-xl' : 'text-[28px]'} leading-none font-bold text-gray-900 tracking-tight`}>{peso(total)}</span>
      <span className="flex items-center gap-1 text-xs">
        {delta.percent === null ? (
          <span className="text-gray-500">{total > 0 ? `None in the ${RANGES[range].comparedWith}` : `Nothing in the last ${RANGES[range].label}`}</span>
        ) : (
          <>
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${delta.direction === 'up' ? 'bg-emerald-50 text-emerald-700' : delta.direction === 'down' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
              {delta.direction === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
              {delta.direction === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta.direction === 'flat' ? 'No change' : `${delta.percent}%`}
            </span>
            <span className="text-gray-500" title={`vs ${RANGES[range].comparedWith}`}>{inline ? 'vs prev.' : `vs ${RANGES[range].comparedWith}`}</span>
          </>
        )}
      </span>
    </div>
  );

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 tight:p-4 flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 min-w-0">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Earnings</h2>
            <p className="text-xs text-gray-500 mt-0.5 tight:hidden">
              {metric === 'fees' ? 'Platform fees Kayod collected' : 'Value of the jobs completed'}
            </p>
          </div>
          {/* On a short window the total moves up beside the title, so the
              chart keeps the height of its own row. */}
          <div className="hidden tight:flex">{summary(true)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={metric} onChange={setMetric} options={[['fees', 'Platform fees'], ['jobValue', 'Job value']]} />
          <Segmented value={range} onChange={setRange} options={[['7d', '7D'], ['30d', '30D'], ['12m', '12M']]} />
        </div>
      </div>

      <div className="mt-4 compact:mt-3 tight:hidden flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          {summary(false)}
          <p className="mt-1.5 text-xs text-gray-500">
            {METRICS[metric].countLabel(count)}
            {best && <> · best {RANGES[range].unit} <span className="font-semibold text-gray-700">{best.fullLabel.replace(/^\w+, /, '')}</span> ({peso(best.value)})</>}
          </p>
        </div>
        {/* Legend; the dashed entry switches the comparison line on and off. */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-3 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            Last {RANGES[range].label}
          </span>
          <button
            type="button"
            onClick={() => setShowPrevious((v) => !v)}
            aria-pressed={showPrevious}
            title={showPrevious ? 'Hide the comparison line' : 'Show the comparison line'}
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors hover:bg-gray-50 ${showPrevious ? 'text-gray-600' : 'text-gray-400 line-through'}`}
          >
            <span className="w-3 h-2 rounded-sm border border-dashed" style={{ borderColor: PREVIOUS_COLOR, backgroundColor: '#e2e8f0' }} />
            {RANGES[range].comparedWith.replace(/^previous/, 'Previous')}
          </button>
        </div>
      </div>

      <div className="mt-3 compact:mt-2 tight:mt-2 flex-1 min-h-[220px] fit:min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
              tickFormatter={pesoShort}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
            />
            <Tooltip
              content={<ChartTooltip metric={metric} showPrevious={showPrevious} />}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            {/* The period before, as a soft grey shadow behind this one. */}
            {showPrevious && (
              <Area
                type="monotone"
                dataKey="previous"
                stroke={PREVIOUS_COLOR}
                strokeWidth={1.25}
                strokeDasharray="4 3"
                fill="#e2e8f0"
                fillOpacity={0.55}
                dot={false}
                activeDot={{ r: 3, fill: PREVIOUS_COLOR, stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={range === '30d' ? false : { r: 2.5, fill: color, stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
              animationDuration={500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default EarningsCard;
