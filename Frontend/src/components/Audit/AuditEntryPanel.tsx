import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { formatDistanceStrict } from 'date-fns';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileText,
  Globe,
  Link2,
  ListChecks,
  ShieldAlert,
  UserCog,
  X,
} from 'lucide-react';
import PanelSection from '../UI/PanelSection';
import { useAuditEntry } from '../../hooks/useAudit';
import type { AuditCatalog, AuditEntrySummary, AuditLogEntry } from '../../types/audit.types';
import { AuditChangeTable, detailEntries, hasChanges } from './AuditChanges';
import {
  CONFIG_TARGET_TYPES,
  OPENABLE_TARGET_TYPES,
  areaLook,
  areaOf,
  describeDevice,
  exactTime,
  groupStyle,
  initials,
  lookupAction,
  roleLabel,
  roleText,
  timeAgo,
} from './auditStyle';

const BULK_PREVIEW = 5;

interface AuditEntryPanelProps {
  entryId?: string;
  catalog?: AuditCatalog;
  onClose: () => void;
  /** Open another entry in this panel (the before / after entries). */
  onOpenEntry: (entryId: string) => void;
  /** Filter the log to this admin. */
  onShowAdmin: (adminId: string) => void;
  /** Filter the log to everything done to this target. */
  onShowTarget: (targetId: string, label: string) => void;
  /** Open one report from a bulk entry in the Flagged review modal. */
  onOpenReport: (reportId: string) => void;
  /** Open what the entry was about (user/transaction modal, or its page). */
  onOpenTarget: (log: AuditLogEntry) => void;
  /** Another modal is open on top (a user or transaction it opened): Escape is theirs. */
  covered?: boolean;
}

/** A fact in a two-column grid: small label above, value below. */
const Fact: React.FC<{ label: string; children: React.ReactNode; mono?: boolean; wide?: boolean }> = ({ label, children, mono, wide }) => (
  <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className={`mt-0.5 break-words text-gray-900 ${mono ? 'font-mono text-xs' : 'text-sm font-semibold'}`}>{children}</dd>
  </div>
);

const LinkButton: React.FC<{ onClick: () => void; testId?: string; children: React.ReactNode }> = ({ onClick, testId, children }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
  >
    {children}
  </button>
);

/**
 * One audit entry, in the details-panel standard (UI/PanelSection), who → what
 * → when → where:
 *   Admin (who did it) · the record it touched, as it is now · what changed ·
 *   Timeline (when, with what the same admin did just before and after) ·
 *   Origin (where from).
 * Longer histories are a click away — "all their actions" and "every action on
 * this record" filter the log itself instead of growing lists in here.
 *
 * Opened by clicking a row; the URL carries the entry (?entry=), so "Copy link"
 * hands another superadmin this exact view. It sits under the user and
 * transaction modals it can open (z 80/81 against their 100/101).
 */
const AuditEntryPanel: React.FC<AuditEntryPanelProps> = ({
  entryId,
  catalog,
  onClose,
  onOpenEntry,
  onShowAdmin,
  onShowTarget,
  onOpenTarget,
  onOpenReport,
  covered,
}) => {
  const isOpen = Boolean(entryId);
  const { data, isLoading, isError } = useAuditEntry(entryId);
  const [showAllBulk, setShowAllBulk] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A different entry starts at the top, with the bulk list collapsed.
  useEffect(() => {
    setShowAllBulk(false);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [entryId]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || covered) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, covered, onClose]);

  if (!isOpen) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link to this entry copied');
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const area = data ? areaLook(areaOf({ key: data.action.key, group: data.action.group || '' })) : null;
  const { pill, icon: AreaIcon } = groupStyle(data?.action.group);

  /** A neighbouring entry by the same admin: what it was, and how far from this one. */
  const renderNeighbour = (entry: AuditEntrySummary, side: 'before' | 'after', at: string) => {
    const action = lookupAction(catalog, entry.actionType);
    const gap = formatDistanceStrict(new Date(entry.createdAt), new Date(at));
    return (
      <li className="relative">
        {side === 'before' && <span className="absolute left-[4px] top-4 -bottom-3 w-px bg-gray-200" aria-hidden="true" />}
        <button
          type="button"
          onClick={() => onOpenEntry(entry._id)}
          data-testid={`audit-entry-${side}`}
          className="w-full text-left flex gap-3 rounded-lg -mx-2 px-2 py-1.5 hover:bg-gray-50 transition-colors"
          title="Open this entry"
        >
          <span className="relative mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white bg-gray-300" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-gray-700">
              {action.label}
              <span className="font-normal text-gray-400"> · {gap} {side === 'before' ? 'earlier' : 'later'}</span>
            </span>
            <span className="block text-[11px] text-gray-500 truncate">{entry.description}</span>
          </span>
        </button>
      </li>
    );
  };

  const body = (() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      );
    }
    if (isError || !data) {
      return (
        <div className="p-12 text-center">
          <p className="text-gray-700 font-semibold">This entry couldn't be loaded</p>
          <p className="text-sm text-gray-500 mt-1">It may have been removed, or the link is wrong.</p>
        </div>
      );
    }

    const { log, origin, target, aboutTargetTotal, adminHistory } = data;
    const admin = log.adminId;
    const device = describeDevice(origin.userAgent);
    const location = origin.location && origin.location !== 'Unknown' ? origin.location : null;
    const details = detailEntries(log.metadata);
    const changed = hasChanges(log.metadata);
    const selfTarget = Boolean(target?.id && admin && target.id === String(admin._id));
    // A record with nothing to say beyond its kind (the settings, say) gets no
    // section of its own — just the link to open it, under the sentence.
    const saysMore = Boolean(target && (target.facts.length > 0 || target.exists === false || (target.label && target.label !== target.kind)));
    const showTarget = Boolean(target && !selfTarget && !data.bulk && saysMore);
    const canOpenTarget = Boolean(target?.type && OPENABLE_TARGET_TYPES.has(target.type) && target.exists !== false && !selfTarget);
    const kind = (target?.kind || 'record').toLowerCase();
    const openLabel = target?.type && CONFIG_TARGET_TYPES.has(target.type) ? 'Open in Settings' : `Open this ${kind}`;
    const bulkItems = data.bulk ? (showAllBulk ? data.bulk.items : data.bulk.items.slice(0, BULK_PREVIEW)) : [];

    return (
      <>
        {/* What happened, in a sentence */}
        <div className="px-5 md:px-6 py-5 border-b border-gray-100" data-testid="audit-entry-summary">
          <p className="text-[15px] text-gray-900 leading-relaxed break-words">{log.description}</p>
          {data.action.sensitive && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700" data-testid="audit-entry-sensitive">
              <ShieldAlert className="h-3.5 w-3.5 mt-px flex-shrink-0" />
              <span>
                <span className="font-bold">Sensitive</span> — it changes someone's access, moves money, or changes what every user sees.
              </span>
            </p>
          )}
          {canOpenTarget && !showTarget && !data.bulk && (
            <div className="mt-3">
              <LinkButton onClick={() => onOpenTarget(log)} testId="audit-entry-open-target">
                {openLabel} <ArrowUpRight className="h-3 w-3" />
              </LinkButton>
            </div>
          )}
        </div>

        {/* Who */}
        <PanelSection icon={UserCog} label="Admin" description="Who did it" testId="audit-entry-admin">
          <div className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
              <span className="text-sm font-bold text-blue-600 uppercase">{initials(admin?.name)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[9px] font-black uppercase tracking-wider ${roleText(admin?.userType)}`}>
                {roleLabel(admin?.userType) || 'Admin'}
                {admin?.accountStatus && admin.accountStatus !== 'active' && (
                  <span className="text-red-600"> · access {admin.accountStatus}</span>
                )}
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">{admin?.name || 'Unknown admin'}</p>
              <p className="text-[11px] text-gray-500 truncate">{admin?.email || 'No email'}</p>
            </div>
          </div>
          {admin && adminHistory.total > 1 && (
            <div className="mt-3">
              <LinkButton onClick={() => onShowAdmin(String(admin._id))} testId="audit-entry-show-admin">
                See all {adminHistory.total.toLocaleString()} of their actions <ArrowRight className="h-3 w-3" />
              </LinkButton>
            </div>
          )}
        </PanelSection>

        {/* What — the record it touched */}
        {showTarget && target && (
          <PanelSection
            icon={FileText}
            label={target.kind}
            description={target.exists === false ? 'What it was done to — since deleted' : 'What it was done to, as it is now'}
            testId="audit-entry-target"
          >
            <p className="text-sm font-bold text-gray-900 break-words">{target.label || target.kind}</p>
            {target.exists === false && (
              <p className="mt-1 text-xs text-gray-500">
                The record was deleted after this entry; its name is kept from the time of the action.
              </p>
            )}
            {target.facts.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {target.facts.map((fact) => (
                  <Fact key={fact.label} label={fact.label}>{fact.value}</Fact>
                ))}
              </dl>
            )}
            {(canOpenTarget || (target.id && aboutTargetTotal > 0)) && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {canOpenTarget && (
                  <LinkButton onClick={() => onOpenTarget(log)} testId="audit-entry-open-target">
                    {openLabel} <ArrowUpRight className="h-3 w-3" />
                  </LinkButton>
                )}
                {target.id && aboutTargetTotal > 0 && (
                  <LinkButton onClick={() => onShowTarget(target.id!, target.label || target.kind)} testId="audit-entry-show-target">
                    {aboutTargetTotal.toLocaleString()} other action{aboutTargetTotal === 1 ? '' : 's'} on it <ArrowRight className="h-3 w-3" />
                  </LinkButton>
                )}
              </div>
            )}
          </PanelSection>
        )}

        {/* What — a batch: the reports it touched */}
        {data.bulk && (
          <PanelSection
            icon={FileText}
            label={`Reports (${data.bulk.total.toLocaleString()})`}
            description="What the batch touched, as they are now"
            testId="audit-entry-bulk"
          >
            <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {bulkItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!item.exists}
                    onClick={() => onOpenReport(item.id)}
                    data-testid="audit-entry-bulk-item"
                    className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 disabled:hover:bg-white disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{item.label}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{[item.kind, item.detail].filter(Boolean).join(' · ')}</span>
                    </span>
                    {item.status && <span className="text-[11px] font-semibold text-gray-600 flex-shrink-0" title="Status now">{item.status}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {data.bulk.items.length > BULK_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllBulk((v) => !v)}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {showAllBulk ? 'Show fewer' : `Show all ${data.bulk.items.length}`}
              </button>
            )}
            {data.bulk.total > data.bulk.items.length && showAllBulk && (
              <p className="text-[11px] text-gray-500 mt-1">The first {data.bulk.items.length} of {data.bulk.total.toLocaleString()} are listed.</p>
            )}
          </PanelSection>
        )}

        {/* What — what changed, and anything else recorded */}
        {(changed || details.length > 0) && (
          <PanelSection
            icon={ListChecks}
            label={changed ? 'Changes' : 'Details'}
            description={changed ? 'Before and after, and what else was recorded' : 'What was recorded with it'}
            testId="audit-entry-changes"
          >
            {changed && <AuditChangeTable metadata={log.metadata} />}
            {details.length > 0 && (
              <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 ${changed ? 'mt-4' : ''}`} data-testid="audit-entry-details">
                {details.map(({ key, label, value }) => (
                  <Fact key={key} label={label} wide={value.length > 40}>{value}</Fact>
                ))}
              </dl>
            )}
          </PanelSection>
        )}

        {/* When */}
        <PanelSection
          icon={Clock}
          label="Timeline"
          description={adminHistory.before || adminHistory.after ? 'When it happened, and what they did around it' : 'When it happened'}
          testId="audit-entry-timeline"
        >
          {/* In order, like the other panels' timelines: just before, this, just after. */}
          <ol className="space-y-1">
            {adminHistory.before && renderNeighbour(adminHistory.before, 'before', log.createdAt)}
            <li className="relative flex gap-3 py-1.5" data-testid="audit-entry-when">
              {adminHistory.after && <span className="absolute left-[4px] top-4 -bottom-3 w-px bg-gray-200" aria-hidden="true" />}
              <span className="relative mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-blue-100 bg-blue-600" />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-gray-900">This action</span>
                <span className="block text-[11px] text-gray-500">
                  {exactTime(log.createdAt)} ({timeAgo(log.createdAt)})
                </span>
              </span>
            </li>
            {adminHistory.after && renderNeighbour(adminHistory.after, 'after', log.createdAt)}
          </ol>
        </PanelSection>

        {/* Where */}
        <PanelSection icon={Globe} label="Origin" description="Where it was done from" testId="audit-entry-origin" last>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact label="Location">{location || (origin.ipAddress ? 'Unknown' : 'Not recorded')}</Fact>
            <Fact label="Device">{device || 'Not recorded'}</Fact>
            <Fact label="IP address" mono>{origin.ipAddress || 'Not recorded'}</Fact>
          </dl>
        </PanelSection>
      </>
    );
  })();

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/50 z-[80] transition-opacity" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Audit entry"
        data-testid="audit-entry-panel"
        className="fixed right-0 top-0 h-full w-full md:w-[560px] bg-white z-[81] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header: the action, in its area's colour */}
        <div className="flex-shrink-0 border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pill}`}>
              <AreaIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-wider ${area?.text || 'text-gray-400'}`}>
                {data ? area?.label || data.action.groupLabel || 'Audit entry' : 'Audit entry'}
              </p>
              <h2 className="text-lg font-bold text-gray-900 truncate" data-testid="audit-entry-title">
                {data ? data.action.label : 'Loading…'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto">
          {body}
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500 hidden sm:block">Share this exact entry with another superadmin.</p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={copyLink}
              disabled={!data}
              data-testid="audit-entry-copy-link"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              Copy link
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs md:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default AuditEntryPanel;
