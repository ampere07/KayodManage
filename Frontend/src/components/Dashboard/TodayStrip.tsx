import React from 'react';
import type { DashboardOverview } from '../../types/dashboard.types';

/** Today's numbers as one quiet line, beside the "Last 30 days" label. */
const TodayStrip: React.FC<{ today: DashboardOverview['today'] }> = ({ today }) => {
  const items: [number, string][] = [
    [today.newClients, today.newClients === 1 ? 'new customer' : 'new customers'],
    [today.newProviders, today.newProviders === 1 ? 'new provider' : 'new providers'],
    [today.jobsPosted, today.jobsPosted === 1 ? 'job posted' : 'jobs posted'],
    [today.jobsCompleted, today.jobsCompleted === 1 ? 'job completed' : 'jobs completed'],
  ];
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500" data-testid="dashboard-today">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Today</span>
      {items.map(([value, label]) => (
        <span key={label}>
          <span className={`font-semibold tabular-nums ${value ? 'text-gray-900' : 'text-gray-400'}`}>{value}</span> {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="font-semibold text-gray-900 tabular-nums">{today.online}</span> online now
      </span>
    </p>
  );
};

export default TodayStrip;
