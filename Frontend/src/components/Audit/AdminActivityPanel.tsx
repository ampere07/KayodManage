import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useAdminActivity, useAuditCatalog } from '../../hooks/useAudit';
import AuditActionBadge from './AuditActionBadge';
import AuditChanges from './AuditChanges';
import { exactTime, lookupAction, timeAgo } from './auditStyle';

const PAGE = 15;

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }> = ({ label, value, sub, tone }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 min-w-0">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className={`text-sm font-bold truncate ${tone || 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-[10px] text-gray-500 truncate">{sub}</p>}
  </div>
);

/**
 * One admin's activity for the Edit Admin panel: when they were last here, how
 * much they've done (and how much of it was sensitive), what kind of work it
 * was, and a timeline whose rows open to show exactly what changed.
 */
const AdminActivityPanel: React.FC<{
  adminId: string;
  onOpenAuditLog: () => void;
  /** Open one entry's full details on the Audit Log page. */
  onOpenEntry: (entryId: string) => void;
}> = ({ adminId, onOpenAuditLog, onOpenEntry }) => {
  const [limit, setLimit] = useState(PAGE);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: catalog } = useAuditCatalog();
  const { data, isLoading, isFetching, isError } = useAdminActivity(adminId, limit);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-50 border border-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-sm text-gray-600">Couldn't load this admin's activity.</p>;
  }

  const { summary, activities } = data;

  return (
    <div className="space-y-5" data-testid="admin-activity-panel">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Tile label="Last login" value={timeAgo(summary.lastLogin)} sub={summary.lastLogin ? exactTime(summary.lastLogin) : undefined} />
        <Tile label="Last action" value={timeAgo(summary.lastActionAt)} sub={summary.lastActionAt ? exactTime(summary.lastActionAt) : undefined} />
        <Tile label="Actions" value={`${summary.last7d} this week`} sub={`${summary.last30d} in 30 days · ${summary.logins30d} sign-ins`} />
        <Tile
          label="Sensitive (30 days)"
          value={summary.sensitive30d}
          tone={summary.sensitive30d ? 'text-red-700' : 'text-gray-900'}
          sub="access, money, bans, settings"
        />
      </div>

      {summary.byAction30d.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">What they did in the last 30 days</p>
          <div className="flex flex-wrap gap-1.5" data-testid="admin-activity-breakdown">
            {summary.byAction30d.map((entry) => (
              <span
                key={entry.actionType}
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border px-2 py-0.5 ${
                  entry.sensitive ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {entry.label}
                <span className="text-gray-500 font-bold">×{entry.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700">
            Timeline <span className="text-gray-400 font-normal">({data.total.toLocaleString()} entries)</span>
          </p>
          <button
            type="button"
            onClick={onOpenAuditLog}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
            data-testid="admin-activity-open-log"
          >
            Open in Audit Log <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            No actions logged for this admin yet.
          </p>
        ) : (
          <ul className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {activities.map((item) => {
              const open = expanded === item._id;
              const action = lookupAction(catalog, item.actionType);
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : item._id)}
                    className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AuditActionBadge action={action} size="sm" />
                        <span className="text-[10px] text-gray-500" title={exactTime(item.createdAt)}>
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mt-1 break-words">{item.description}</p>
                    </div>
                    {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />}
                  </button>
                  {open && (
                    <div className="px-3 pb-3 space-y-2">
                      <AuditChanges metadata={item.metadata} ipAddress={item.ipAddress} />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-gray-400">{exactTime(item.createdAt)}</p>
                        <button
                          type="button"
                          onClick={() => onOpenEntry(item._id)}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
                          data-testid="admin-activity-open-entry"
                        >
                          See full details <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {data.hasMore && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            disabled={isFetching}
            className="mt-2 w-full text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            {isFetching ? 'Loading…' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminActivityPanel;
