import React from 'react';
import { format } from 'date-fns';
import type { AuditMetadata } from '../../types/audit.types';
import { describeDevice, fieldLabel } from './auditStyle';

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  jobs: 'Jobs',
  transactions: 'Transactions',
  verifications: 'Verifications',
  support: 'Support',
  activity: 'Activity',
  flagged: 'Flagged',
  settings: 'Settings',
};

// Shown elsewhere (the target, the change table, the "from" line) or internal.
const HIDDEN_DETAILS = new Set([
  'targetName', 'changes', 'granted', 'revoked', 'userAgent', 'location', 'order',
  'adminUsername', 'jobTitle', 'subject', 'userName',
]);

// Friendlier names than the field names, where the field name reads oddly.
const DETAIL_LABELS: Record<string, string> = {
  refundedAmount: 'Refunded',
  suspendedUntil: 'Suspended until',
  expiresAt: 'Ends',
  escrowScheduledFor: 'Escrow release scheduled',
  escrowResumedFrom: 'Escrow originally due',
  escrowReleasedImmediately: 'Escrow released at once',
  rebookDeadlineAt: 'Rebook deadline',
  adminNotes: 'Admin notes',
  manualRun: 'Run manually',
  changedParts: 'Parts edited',
  rejectionReason: 'Rejection reason',
  actionTaken: 'Action taken',
  reportType: 'Report type',
  ticketId: 'Ticket',
  providerName: 'Provider',
  accountStatus: 'Account status',
};

const MONEY_KEYS = /amount$|^amount$|fee$|budget$/i;
const DATE_KEYS = /(At|Until|For|From|Date)$/;
const WORD_VALUE_KEYS = new Set(['outcome', 'resolution', 'status', 'actionTaken', 'reportType', 'role', 'type', 'accountStatus', 'reason']);

const humanize = (text: string) => text.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** A recorded value as a person would write it: ₱1,250.00, "7 days", "Oct 30, 2026 at 4:16 PM". */
export const formatDetailValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => formatDetailValue(key, v)).join(', ') : 'None';
  if (key === 'duration' && typeof value === 'number') return value < 0 ? 'Indefinitely' : `${value} day${value === 1 ? '' : 's'}`;
  if (typeof value === 'number' && MONEY_KEYS.test(key)) {
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof value === 'string' && DATE_KEYS.test(key) && !Number.isNaN(Date.parse(value))) {
    const date = new Date(value);
    return date.getFullYear() >= 9999 ? 'Until turned back on' : format(date, "MMM d, yyyy 'at' h:mm a");
  }
  if (typeof value === 'string' && WORD_VALUE_KEYS.has(key)) return humanize(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Short values only: a detail row is a fact, not a dump. */
const isShowable = (key: string, value: unknown) =>
  !HIDDEN_DETAILS.has(key) &&
  !/Ids?$/.test(key) &&
  value !== null &&
  value !== undefined &&
  value !== '' &&
  (typeof value !== 'object' || (Array.isArray(value) && value.every((v) => typeof v !== 'object'))) &&
  formatDetailValue(key, value).length <= 240;

export const detailEntries = (metadata: AuditMetadata = {}) =>
  Object.entries(metadata)
    .filter(([key, value]) => isShowable(key, value))
    .map(([key, value]) => ({ key, label: DETAIL_LABELS[key] || fieldLabel(key), value: formatDetailValue(key, value) }));

export const hasChanges = (metadata: AuditMetadata = {}) =>
  Object.keys(metadata.changes || {}).length > 0 || (metadata.granted || []).length > 0 || (metadata.revoked || []).length > 0;

/** Each changed value's before and after, plus permissions switched on and off. */
export const AuditChangeTable: React.FC<{ metadata?: AuditMetadata }> = ({ metadata = {} }) => {
  const changes = Object.entries(metadata.changes || {});
  const granted = metadata.granted || [];
  const revoked = metadata.revoked || [];
  if (!changes.length && !granted.length && !revoked.length) return null;

  return (
    <div className="space-y-3 text-xs" data-testid="audit-changes">
      {changes.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <span className="px-3 py-1.5">Changed</span>
            <span className="px-3 py-1.5">Before</span>
            <span className="px-3 py-1.5">After</span>
          </div>
          {changes.map(([field, change]) => (
            <div key={field} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-gray-100">
              <span className="px-3 py-2 font-medium text-gray-700 break-words">{DETAIL_LABELS[field] || fieldLabel(field)}</span>
              <span className="px-3 py-2 text-gray-500 line-through decoration-gray-300 break-words">{formatDetailValue(field, change.from)}</span>
              <span className="px-3 py-2 font-semibold text-gray-900 break-words">{formatDetailValue(field, change.to)}</span>
            </div>
          ))}
        </div>
      )}

      {(granted.length > 0 || revoked.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {granted.map((key) => (
            <span key={`g-${key}`} className="px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 font-semibold">
              + {PERMISSION_LABELS[key] || key}
            </span>
          ))}
          {revoked.map((key) => (
            <span key={`r-${key}`} className="px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 font-semibold">
              − {PERMISSION_LABELS[key] || key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** The other facts the entry recorded (reason, duration, outcome, amount…), as label/value rows. */
export const AuditDetails: React.FC<{ metadata?: AuditMetadata; columns?: 1 | 2 }> = ({ metadata = {}, columns = 2 }) => {
  const details = detailEntries(metadata);
  if (!details.length) return null;
  return (
    <dl className={`grid grid-cols-1 ${columns === 2 ? 'sm:grid-cols-2' : ''} gap-x-6 gap-y-2 text-xs`} data-testid="audit-details">
      {details.map(({ key, label, value }) => (
        <div key={key} className="min-w-0">
          <dt className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</dt>
          <dd className="text-sm text-gray-900 font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

/**
 * Everything behind a log row in one block — used where there's no room for the
 * full entry panel (the Edit Admin timeline).
 */
const AuditChanges: React.FC<{ metadata?: AuditMetadata; ipAddress?: string | null }> = ({ metadata = {}, ipAddress }) => {
  const device = describeDevice(metadata.userAgent);
  const details = detailEntries(metadata);
  if (!hasChanges(metadata) && !details.length && !device && !ipAddress) return null;
  return (
    <div className="space-y-3">
      <AuditChangeTable metadata={metadata} />
      <AuditDetails metadata={metadata} />
      {(device || ipAddress) && (
        <p className="text-[11px] text-gray-500">
          {[device, ipAddress && `IP ${ipAddress}`].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
};

export default AuditChanges;
