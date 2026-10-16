import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  FileText,
  Flag,
  LifeBuoy,
  Shield,
  ShieldCheck,
  Star,
  Wallet
} from 'lucide-react';
import { useUserActivity, useUserFinancials, useUserJobs } from '../../hooks/useUsers';
import { formatPHPCurrency } from '../../utils/currency';
import type {
  ActivityEventType,
  UserActivityEvent,
  UserJob
} from '../../types/users.types';

/**
 * The three history views behind the user detail panel: what they did, what
 * they posted, and what money went in and out.
 *
 * Each one fetches only while its tab is open. Opening a user is the common
 * case and a timeline merged out of nine collections is not, so none of this
 * runs until an admin actually asks for it.
 */

/**
 * The filter row and the pager stay put while the list scrolls under them.
 *
 * The panel's scroll container is the modal's content area, which pads its
 * children — so a sticky bar has to bleed back out to the full width with
 * negative margins, or rows would show through at the left and right edges as
 * they pass behind it.
 */
const STICKY_BAR = 'sticky z-10 bg-white -mx-4 md:-mx-6 px-4 md:px-6';

/**
 * A row the admin can open. Quote, review and report rows all point at a job,
 * so they open one too. Verification and admin rows carry a target this panel
 * has no view for, and are deliberately left inert rather than looking
 * clickable and doing nothing.
 */
export interface HistoryTarget {
  type: 'job' | 'transaction' | 'support';
  id: string;
}

const OPENABLE: HistoryTarget['type'][] = ['job', 'transaction', 'support'];

const targetOf = (event: UserActivityEvent): HistoryTarget | null =>
  event.targetId && OPENABLE.includes(event.targetType as HistoryTarget['type'])
    ? { type: event.targetType as HistoryTarget['type'], id: String(event.targetId) }
    : null;

/** Rows that lead somewhere say so on hover and answer the keyboard. */
const openableRowProps = (onOpen?: () => void) =>
  onOpen
    ? {
        onClick: onOpen,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        },
        role: 'button' as const,
        tabIndex: 0,
        className:
          'cursor-pointer -mx-2 px-2 rounded-lg hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors'
      }
    : {};

const money = (amount?: number | null) => formatPHPCurrency(amount || 0);

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const dateTime = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

/** Status words come straight from several different collections' enums. */
const STATUS_TONE: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  held: 'bg-amber-50 text-amber-700 border-amber-200',
  escrowed: 'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200'
};

const StatusChip: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return null;
  const tone = STATUS_TONE[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${tone}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const EVENT_ICON: Record<ActivityEventType, React.ElementType> = {
  job: Briefcase,
  money: Wallet,
  quote: FileText,
  review: Star,
  verification: ShieldCheck,
  support: LifeBuoy,
  report: Flag,
  admin: Shield
};

const EVENT_TONE: Record<ActivityEventType, string> = {
  job: 'bg-blue-50 text-blue-600',
  money: 'bg-emerald-50 text-emerald-600',
  quote: 'bg-indigo-50 text-indigo-600',
  review: 'bg-yellow-50 text-yellow-600',
  verification: 'bg-teal-50 text-teal-600',
  support: 'bg-sky-50 text-sky-600',
  report: 'bg-orange-50 text-orange-600',
  admin: 'bg-red-50 text-red-600'
};

const ACTIVITY_FILTERS: { key: string; label: string; types?: ActivityEventType[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'job', label: 'Jobs', types: ['job'] },
  { key: 'money', label: 'Money', types: ['money'] },
  { key: 'quote', label: 'Quotes', types: ['quote'] },
  { key: 'review', label: 'Reviews', types: ['review'] },
  { key: 'support', label: 'Support', types: ['support', 'report'] },
  { key: 'admin', label: 'Admin', types: ['admin', 'verification'] }
];

const Spinner: React.FC = () => (
  <div className="flex justify-center py-10">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-center text-sm text-gray-500 py-10">{message}</p>
);

const StatTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'in' | 'out' | 'neutral';
}> = ({ label, value, sub, tone = 'neutral' }) => {
  const palette = {
    in: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    out: 'bg-rose-50 border-rose-100 text-rose-900',
    neutral: 'bg-gray-50 border-gray-100 text-gray-900'
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${palette}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-lg font-black mt-1 break-words">{value}</p>
      {sub && <p className="text-[10px] font-medium opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
};

/* ------------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------------ */

const ActivityRow: React.FC<{ event: UserActivityEvent; onOpen?: () => void }> = ({
  event,
  onOpen
}) => {
  const Icon = EVENT_ICON[event.type] || Briefcase;
  const tone = EVENT_TONE[event.type] || 'bg-gray-50 text-gray-600';
  const isMoney = event.type === 'money' && typeof event.amount === 'number';
  const rowProps = openableRowProps(onOpen);

  return (
    <li
      {...rowProps}
      className={`flex gap-3 py-3 ${rowProps.className || ''}`}
      data-testid={onOpen ? `activity-row-open-${event.id}` : undefined}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{event.title}</p>
          {isMoney && (
            <p
              className={`text-sm font-bold whitespace-nowrap ${
                event.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {event.direction === 'in' ? '+' : '−'}
              {money(event.amount)}
            </p>
          )}
          {!isMoney && typeof event.amount === 'number' && (
            <p className="text-sm font-bold text-gray-700 whitespace-nowrap">{money(event.amount)}</p>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-gray-600 mt-0.5 break-words">{event.description}</p>
        )}
        <div className="flex items-center flex-wrap gap-2 mt-1.5">
          <span className="text-[10px] text-gray-400 font-medium">{dateTime(event.timestamp)}</span>
          <StatusChip status={event.status} />
          {event.actor && (
            <span className="text-[10px] text-gray-500 font-medium">by {event.actor}</span>
          )}
          {typeof event.rating === 'number' && (
            <span className="text-[10px] font-bold text-yellow-600">{event.rating}★</span>
          )}
        </div>
      </div>
    </li>
  );
};

export const UserActivityTab: React.FC<{
  userId: string;
  onOpenTarget?: (target: HistoryTarget) => void;
}> = ({ userId, onOpenTarget }) => {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const types = ACTIVITY_FILTERS.find((f) => f.key === filter)?.types;
  const { data, isLoading, isError } = useUserActivity(userId, {
    page,
    limit: 25,
    types: types ? types.join(',') : undefined
  });

  const changeFilter = (key: string) => {
    setFilter(key);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className={`${STICKY_BAR} top-0 -mt-6 pt-6 pb-3 flex flex-wrap gap-1.5 border-b border-gray-100`}>
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => changeFilter(f.key)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${
              filter === f.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {isError && <EmptyState message="Could not load this user's activity." />}

      {!isLoading && !isError && (
        <>
          {data && data.events.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {data.events.map((event) => {
                const target = onOpenTarget ? targetOf(event) : null;
                return (
                  <ActivityRow
                    key={event.id}
                    event={event}
                    onOpen={target ? () => onOpenTarget!(target) : undefined}
                  />
                );
              })}
            </ul>
          ) : (
            <EmptyState message="No activity recorded for this user yet." />
          )}

          {(page > 1 || data?.pagination.hasMore) && (
            <div className={`${STICKY_BAR} bottom-0 -mb-6 py-3 flex items-center justify-between border-t border-gray-100`}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400"
              >
                Previous
              </button>
              <span className="text-[11px] font-medium text-gray-500">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data?.pagination.hasMore}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ *
 * Jobs
 * ------------------------------------------------------------------------ */

const JobRow: React.FC<{ job: UserJob; onOpen?: () => void }> = ({ job, onOpen }) => {
  const rowProps = openableRowProps(onOpen);

  return (
  <li {...rowProps} className={`py-3 ${rowProps.className || ''}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 break-words">{job.title}</p>
        <div className="flex items-center flex-wrap gap-2 mt-1">
          <span
            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
              job.userRole === 'poster'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
          >
            {job.userRole === 'poster' ? 'Posted' : 'Worked'}
          </span>
          <StatusChip status={job.status} />
          {job.category && (
            <span className="text-[10px] text-gray-500 font-medium uppercase">{job.category}</span>
          )}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <p className="text-sm font-bold text-gray-900">{money(job.value)}</p>
        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{shortDate(job.createdAt)}</p>
      </div>
    </div>
  </li>
  );
};

export const UserJobsTab: React.FC<{
  userId: string;
  onOpenTarget?: (target: HistoryTarget) => void;
}> = ({ userId, onOpenTarget }) => {
  const [role, setRole] = useState<'all' | 'posted' | 'worked'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useUserJobs(userId, { page, limit: 20, role });

  const changeRole = (next: 'all' | 'posted' | 'worked') => {
    setRole(next);
    setPage(1);
  };

  const statusEntries = useMemo(
    () => Object.entries(data?.summary.byStatus || {}).sort((a, b) => b[1] - a[1]),
    [data]
  );

  return (
    <div className="space-y-4">
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Posted" value={String(data.summary.posted)} />
            <StatTile label="Worked" value={String(data.summary.worked)} />
            <StatTile label="Posted Value" value={money(data.summary.postedValue)} />
          </div>

          {statusEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {statusEntries.map(([status, count]) => (
                <span
                  key={status}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase rounded border bg-gray-50 text-gray-600 border-gray-200"
                >
                  {status.replace(/_/g, ' ')} · {count}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <div className={`${STICKY_BAR} top-0 py-3 flex gap-1.5 border-b border-gray-100`}>
        {(['all', 'posted', 'worked'] as const).map((key) => (
          <button
            key={key}
            onClick={() => changeRole(key)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full border capitalize transition-colors ${
              role === key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {isError && <EmptyState message="Could not load this user's jobs." />}

      {!isLoading && !isError && (
        <>
          {data && data.jobs.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {data.jobs.map((job) => (
                <JobRow
                  key={job._id}
                  job={job}
                  onOpen={
                    onOpenTarget ? () => onOpenTarget({ type: 'job', id: job._id }) : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState message="No jobs for this user." />
          )}

          {data && data.pagination.pages > 1 && (
            <div className={`${STICKY_BAR} bottom-0 -mb-6 py-3 flex items-center justify-between border-t border-gray-100`}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400"
              >
                Previous
              </button>
              <span className="text-[11px] font-medium text-gray-500">
                Page {page} of {data.pagination.pages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.pages}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ *
 * Money
 * ------------------------------------------------------------------------ */

export const UserMoneyTab: React.FC<{ userId: string }> = ({ userId }) => {
  const { data, isLoading, isError } = useUserFinancials(userId);

  if (isLoading) return <Spinner />;
  if (isError || !data) return <EmptyState message="Could not load this user's money history." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Total Topped Up"
          value={money(data.topUp.total)}
          sub={
            data.topUp.pending > 0
              ? `${money(data.topUp.pending)} pending · ${data.topUp.count} completed`
              : `${data.topUp.count} completed`
          }
          tone="in"
        />
        <StatTile
          label="Total Cashed Out"
          value={money(data.cashOut.total)}
          sub={
            data.cashOut.pending > 0
              ? `${money(data.cashOut.pending)} pending · ${data.cashOut.count} completed`
              : `${data.cashOut.count} completed`
          }
          tone="out"
        />
        <StatTile label="Earned" value={money(data.earned)} sub="Received, excluding top-ups" />
        <StatTile label="Spent" value={money(data.spent)} sub="Paid out, excluding cash-outs" />
        <StatTile label="Fees Paid" value={money(data.feesPaid)} />
        <StatTile label="Refunded" value={money(data.refunded)} />
      </div>

      <section>
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
          Top-ups
        </h4>
        {data.topUp.entries.length === 0 ? (
          <EmptyState message="This user has never topped up." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.topUp.entries.map((entry) => (
              <li key={entry._id} className="py-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {entry.description || 'Wallet top-up'}
                  </p>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {dateTime(entry.completedAt || entry.createdAt)}
                    </span>
                    <StatusChip status={entry.status} />
                    {entry.method && (
                      <span className="text-[10px] text-gray-500 font-medium uppercase">
                        {entry.method}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                  +{money(entry.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          Cash-outs
        </h4>
        {data.cashOut.entries.length === 0 ? (
          <EmptyState message="This user has never cashed out." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.cashOut.entries.map((entry) => (
              <li key={entry._id} className="py-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {[entry.destination, entry.accountNumber].filter(Boolean).join(' · ') ||
                      'Withdrawal'}
                  </p>
                  {entry.accountHolder && (
                    <p className="text-xs text-gray-600 mt-0.5">{entry.accountHolder}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {dateTime(entry.completedAt || entry.createdAt)}
                    </span>
                    <StatusChip status={entry.status} />
                    {entry.reference && (
                      <span className="text-[10px] text-gray-500 font-medium">{entry.reference}</span>
                    )}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-sm font-bold text-rose-600">−{money(entry.netAmount)}</p>
                  {entry.fee > 0 && (
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {money(entry.fee)} fee
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
