import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Change } from './dashboardFormat';

export type KpiTone = 'emerald' | 'blue' | 'purple' | 'orange';

const TONES: Record<KpiTone, { chip: string; stroke: string }> = {
  emerald: { chip: 'bg-emerald-100 text-emerald-700', stroke: '#10b981' },
  blue: { chip: 'bg-blue-100 text-blue-700', stroke: '#3b82f6' },
  purple: { chip: 'bg-purple-100 text-purple-700', stroke: '#8b5cf6' },
  orange: { chip: 'bg-orange-100 text-orange-700', stroke: '#f97316' },
};

/**
 * The last weeks as small bars, the current week last and darkest: which way
 * the figure is heading, without daily noise.
 */
const WeekBars: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const max = Math.max(...values, 0);
  return (
    <div className="flex items-end gap-[3px] h-full" title={`Weekly, last ${values.length} weeks`} aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${max ? Math.max(8, (v / max) * 100) : 8}%`,
            backgroundColor: color,
            opacity: i === values.length - 1 ? 1 : v ? 0.35 : 0.15,
          }}
        />
      ))}
    </div>
  );
};

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  tone: KpiTone;
  change: Change;
  /** e.g. "previous 30 days" */
  comparedWith: string;
  /** One quiet line under the trend, e.g. "5 customers · 4 providers". */
  detail?: string;
  /** Weekly totals, oldest first, drawn as small bars. */
  weeks: number[];
  /** The page this number comes from. */
  to: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon: Icon, tone, change, comparedWith, detail, weeks, to }) => {
  const { chip, stroke } = TONES[tone];
  const color = change.direction === 'up' ? 'text-emerald-600' : change.direction === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Link
      to={to}
      className="flex flex-col w-full h-full bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-5 lg:p-4 xl:p-5 compact:p-4 tight:p-3 hover:border-gray-300 hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
    >
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${chip}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-xs sm:text-sm font-semibold text-gray-700 truncate" title={title}>{title}</span>
      </div>

      <div className="mt-3 tight:mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 text-xl sm:text-[28px] lg:text-2xl xl:text-[28px] tight:text-2xl leading-none font-bold text-gray-900 tracking-tight truncate" title={value}>{value}</p>
        <span className="hidden sm:block lg:hidden xl:block w-[72px] h-7 flex-shrink-0">
          <WeekBars values={weeks} color={stroke} />
        </span>
      </div>

      <p className="mt-2 tight:mt-1.5 flex flex-wrap items-center gap-x-1 text-[11px] sm:text-xs leading-snug">
        {change.percent === null ? (
          <span className="text-gray-500">{change.direction === 'up' ? `Nothing in the ${comparedWith}` : 'Nothing yet'}</span>
        ) : (
          <>
            <span className={`inline-flex items-center gap-0.5 font-semibold ${color}`}>
              {change.direction === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
              {change.direction === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
              {change.direction === 'flat' ? 'No change' : `${change.percent}%`}
            </span>
            <span className="text-gray-500">vs {comparedWith}</span>
          </>
        )}
      </p>
      {detail && <p className="hidden sm:block mt-1 text-[11px] text-gray-500 truncate compact:hidden">{detail}</p>}
    </Link>
  );
};

export default KpiCard;
