import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminActivity, useAuditCatalog } from '../../hooks/useAudit';
import AuditChanges from './AuditChanges';
import { exactTime, lookupAction, timeAgo } from './auditStyle';

/** Recent actions shown in the panel; the rest are one click away in the Audit Log. */
const RECENT = 5;

const Fact: React.FC<{ label: string; sub?: React.ReactNode; children: React.ReactNode; testId?: string }> = ({ label, sub, children, testId }) => (
  <div className="min-w-0" data-testid={testId}>
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-semibold text-gray-900 truncate">{children}</dd>
    {sub && <dd className="text-[11px] text-gray-500 truncate">{sub}</dd>}
  </div>
);

/**
 * One admin's activity, for the Activity section of the Edit Admin panel: when
 * they joined, signed in and last acted, how much they did in 30 days (and how
 * much of it was sensitive), and their latest actions — each opens to show
 * exactly what changed. The full history is the Audit Log, filtered to them.
 */
const AdminActivityPanel: React.FC<{
  adminId: string;
  /** When the account was created. */
  createdAt?: string | null;
  onOpenAuditLog: () => void;
  /** Open one entry's full details on the Audit Log page. */
  onOpenEntry: (entryId: string) => void;
}> = ({ adminId, createdAt, onOpenAuditLog, onOpenEntry }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: catalog } = useAuditCatalog();
  // Sign-ins have their own list (device, IP, place) in the panel's Sign-in section.
  const { data, isLoading, isError } = useAdminActivity(adminId, RECENT, true, true);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-sm text-gray-600">Couldn't load this admin's activity.</p>;
  }

  const { summary, activities } = data;
  const mostOften = summary.byAction30d.slice(0, 3);

  return (
    <div className="space-y-4" data-testid="admin-activity-panel">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Added" testId="admin-when-added">
          {createdAt ? format(new Date(createdAt), 'MMM d, yyyy') : <span className="text-gray-400">Not recorded</span>}
        </Fact>
        <Fact label="Last sign-in" sub={summary.lastLogin ? exactTime(summary.lastLogin) : undefined} testId="admin-when-signin">
          {summary.lastLogin ? timeAgo(summary.lastLogin) : <span className="text-amber-700">Never</span>}
        </Fact>
        <Fact label="Last action" sub={summary.lastActionAt ? exactTime(summary.lastActionAt) : undefined} testId="admin-when-action">
          {summary.lastActionAt ? timeAgo(summary.lastActionAt) : <span className="text-gray-400">None yet</span>}
        </Fact>
        <Fact label="Last 30 days" sub={`${summary.last7d} this week · ${summary.logins30d} sign-in${summary.logins30d === 1 ? '' : 's'}`} testId="admin-when-30d">
          {summary.last30d} action{summary.last30d === 1 ? '' : 's'}
          {summary.sensitive30d > 0 && <span className="text-red-600"> · {summary.sensitive30d} sensitive</span>}
        </Fact>
      </dl>

      {mostOften.length > 0 && (
        <p className="text-[11px] text-gray-500" data-testid="admin-activity-breakdown">
          <span className="font-medium text-gray-600">Most often: </span>
          {mostOften.map((entry) => `${entry.label} ×${entry.count}`).join(' · ')}
        </p>
      )}

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">No actions logged for this admin yet.</p>
      ) : (
        <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100" data-testid="admin-activity-recent">
          {activities.map((item) => {
            const open = expanded === item._id;
            const action = lookupAction(catalog, item.actionType);
            return (
              <li key={item._id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : item._id)}
                  aria-expanded={open}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 transition-colors"
                  data-testid="admin-activity-row"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-gray-800">
                      {action.label}
                      {item.sensitive && <span className="text-red-600"> · Sensitive</span>}
                      <span className="font-normal text-gray-400" title={exactTime(item.createdAt)}> · {timeAgo(item.createdAt)}</span>
                    </span>
                    <span className="block text-[11px] text-gray-500 line-clamp-2 break-words">{item.description}</span>
                  </span>
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-2">
                    <AuditChanges metadata={item.metadata} ipAddress={item.ipAddress} />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-gray-400">{exactTime(item.createdAt)}</p>
                      <button
                        type="button"
                        onClick={() => onOpenEntry(item._id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
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

      {(data.total > 0 || summary.lastLogin) && (
        <button
          type="button"
          onClick={onOpenAuditLog}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          data-testid="admin-activity-open-log"
        >
          Open their full history in the Audit Log
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default AdminActivityPanel;
