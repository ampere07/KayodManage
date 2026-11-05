import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardOverview } from '../../types/dashboard.types';

/** Plain fact tile, the same look as the user panel's stat tiles; opens the Jobs list on that status. */
const Tile: React.FC<{ label: string; value: number; status: string }> = ({ label, value, status }) => (
  <Link
    to={`/jobs?status=${status}`}
    data-testid={`dashboard-jobs-${status}`}
    className="h-full rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 compact:py-2 tight:py-1.5 flex flex-col justify-center transition-colors hover:border-blue-200 hover:bg-blue-50/40"
  >
    <p className="text-[11px] text-gray-500">{label}</p>
    <p className="text-lg xl:text-2xl compact:text-xl tight:text-lg font-bold text-gray-900 tabular-nums">{value.toLocaleString()}</p>
  </Link>
);

const JobsNowCard: React.FC<{ jobs: DashboardOverview['jobs'] }> = ({ jobs }) => {
  const finished = jobs.completed30 + jobs.cancelled30;
  const cancelledShare = finished ? Math.round((jobs.cancelled30 / finished) * 100) : 0;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 tight:p-4 flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Jobs right now</h2>
          <p className="text-xs text-gray-500 mt-0.5 tight:hidden">Live jobs on the marketplace</p>
        </div>
        <Link to="/jobs" className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap mt-0.5">
          View jobs
        </Link>
      </div>

      {/* The tiles take any spare height (never less than their content), so a
          tall card has bigger tiles rather than a gap. */}
      <div className="mt-4 compact:mt-3 tight:mt-2 grid grid-cols-3 gap-2 flex-1">
        <Tile label="Open" value={jobs.open} status="open" />
        <Tile label="Scheduled" value={jobs.scheduled} status="scheduled" />
        <Tile label="In progress" value={jobs.inProgress} status="in_progress" />
      </div>

      <div className="pt-4 compact:pt-3 tight:pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Last 30 days</span>
          <span className="text-gray-500">{finished ? `${cancelledShare}% cancelled` : 'None finished'}</span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100 overflow-hidden flex" aria-hidden="true">
          {finished > 0 && (
            <>
              <div className="h-full bg-emerald-500" style={{ width: `${100 - cancelledShare}%` }} />
              <div className="h-full bg-red-400" style={{ width: `${cancelledShare}%` }} />
            </>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-700">
          <span className="font-semibold text-gray-900">{jobs.completed30}</span> completed
          <span className="text-gray-300 mx-1.5">·</span>
          <span className="font-semibold text-gray-900">{jobs.cancelled30}</span> cancelled
        </p>
      </div>
    </section>
  );
};

export default JobsNowCard;
