import React from 'react';
import { format, parseISO } from 'date-fns';
import type { AdPlacement, AdStats } from '../../../types/configuration.types';
import { PLACEMENTS, PLACEMENT_META, count, tapRate } from '../../../constants/advertisements';

/**
 * Views and taps the Kayod app counted for an ad (kayod/server
 * advertisementEventsController): a view is the ad's slide shown at least once
 * in a session, a tap is every tap. Days are Philippine calendar days.
 */

const dayLabel = (day: string) => format(parseISO(day), 'MMM d');

/** Daily bars: views as the bar, taps as its darker base. */
export const TrendBars: React.FC<{ daily: AdStats['daily']; height?: number; testId?: string }> = ({ daily, height = 56, testId }) => {
  const peak = Math.max(1, ...daily.map((d) => d.views));
  return (
    <div className="flex items-end gap-[3px]" style={{ height }} data-testid={testId} aria-hidden>
      {daily.map((d) => {
        const viewsHeight = d.views ? Math.max(2, Math.round((d.views / peak) * height)) : 1;
        const tapsHeight = d.taps ? Math.max(2, Math.round((Math.min(d.taps, d.views || d.taps) / peak) * height)) : 0;
        return (
          <div
            key={d.day}
            title={`${dayLabel(d.day)}: ${count(d.views)} view${d.views === 1 ? '' : 's'}, ${count(d.taps)} tap${d.taps === 1 ? '' : 's'}`}
            className="relative flex-1 rounded-sm bg-blue-100"
            style={{ height: viewsHeight }}
          >
            {tapsHeight > 0 && <div className="absolute inset-x-0 bottom-0 rounded-sm bg-blue-500" style={{ height: tapsHeight }} />}
          </div>
        );
      })}
    </div>
  );
};

/** The list row's figures: all-time counts and a 14-day trend. */
export const PerformanceCell: React.FC<{ stats?: AdStats }> = ({ stats }) => {
  if (!stats || (stats.views === 0 && stats.taps === 0)) {
    return <span className="text-[11px] text-gray-400" data-testid="ad-row-performance">No views yet</span>;
  }
  // Three short lines, so a narrow column holds big numbers.
  return (
    <div className="min-w-0" data-testid="ad-row-performance" title={`${count(stats.views)} views, ${count(stats.taps)} taps (${tapRate(stats.views, stats.taps)} tap rate); bars: the last 14 days`}>
      <p className="text-xs font-bold text-gray-900 tabular-nums whitespace-nowrap truncate">
        {count(stats.views)} <span className="font-medium text-gray-500">views</span>
      </p>
      <p className="text-[11px] text-gray-600 tabular-nums whitespace-nowrap truncate">
        {count(stats.taps)} taps · <span className="font-semibold">{tapRate(stats.views, stats.taps)}</span>
      </p>
      <div className="mt-1 w-20 max-w-full"><TrendBars daily={stats.daily} height={12} /></div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-3 min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
    <p className="text-base font-black mt-0.5 leading-tight text-gray-900 tabular-nums">{value}</p>
    {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

/** The panel's Performance section body. */
export const PerformanceDetail: React.FC<{ stats?: AdStats; placements: AdPlacement[] }> = ({ stats, placements }) => {
  if (!stats || (stats.views === 0 && stats.taps === 0)) {
    return (
      <p className="text-sm text-gray-500" data-testid="ad-performance-empty">
        Nothing counted yet. Views and taps appear here once the app shows this ad.
      </p>
    );
  }
  const last14 = stats.daily.reduce((acc, d) => ({ views: acc.views + d.views, taps: acc.taps + d.taps }), { views: 0, taps: 0 });
  return (
    <div data-testid="ad-performance">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Views" value={count(stats.views)} sub={`${count(last14.views)} in 14 days`} />
        <Stat label="Taps" value={count(stats.taps)} sub={`${count(last14.taps)} in 14 days`} />
        <Stat label="Tap rate" value={tapRate(stats.views, stats.taps)} sub="Taps per view" />
      </div>
      <div className="mt-4">
        <TrendBars daily={stats.daily} height={64} testId="ad-performance-bars" />
        <div className="mt-1 flex justify-between text-[10px] text-gray-400">
          <span>{dayLabel(stats.daily[0].day)}</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-100" /> Views</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> Taps</span>
          </span>
          <span>{dayLabel(stats.daily[stats.daily.length - 1].day)}</span>
        </div>
      </div>
      <ul className="mt-4 rounded-lg border border-gray-100 divide-y divide-gray-100">
        {PLACEMENTS.filter((p) => placements.includes(p) || (stats.byPlacement[p]?.views || stats.byPlacement[p]?.taps)).map((p) => {
          const s = stats.byPlacement[p] || { views: 0, taps: 0 };
          return (
            <li key={p} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-gray-700">
                {PLACEMENT_META[p].label}
                {!placements.includes(p) && <span className="ml-1 text-[11px] text-gray-400">(no longer shown here)</span>}
              </span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {count(s.views)} views · {count(s.taps)} taps · {tapRate(s.views, s.taps)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-gray-400">
        {stats.lastSeen ? `Last seen ${format(parseISO(stats.lastSeen), 'MMM d, yyyy')}. ` : ''}
        A view is the ad shown at least once in a person's app session; a tap is every tap.
      </p>
    </div>
  );
};
