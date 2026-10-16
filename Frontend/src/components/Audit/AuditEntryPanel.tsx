import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowDown, ArrowRight, ChevronRight, Globe, Link2, Monitor, MousePointerClick, Wifi } from 'lucide-react';
import SideModal from '../SideModal';
import { UserTypeBadge } from '../UI';
import { useAuditEntry, useAuditLogs } from '../../hooks/useAudit';
import type { AuditCatalog, AuditEntrySummary, AuditLogEntry } from '../../types/audit.types';
import AuditActionBadge from './AuditActionBadge';
import { AuditChangeTable, AuditDetails, detailEntries, hasChanges } from './AuditChanges';
import { OPENABLE_TARGET_TYPES, describeDevice, exactTime, groupStyle, initials, lookupAction, shortTime, timeAgo } from './auditStyle';

const HISTORY_PAGE_SIZE = 10;

interface AuditEntryPanelProps {
  entryId?: string;
  catalog?: AuditCatalog;
  onClose: () => void;
  /** Open another entry in this panel (from the history lists). */
  onOpenEntry: (entryId: string) => void;
  /** Filter the log to this admin. */
  onShowAdmin: (adminId: string) => void;
  /** Filter the log to everything done to this target. */
  onShowTarget: (targetId: string, label: string) => void;
  /** Open one report from a bulk entry in the Flagged review modal. */
  onOpenReport: (reportId: string) => void;
  /** Open what the entry was about (user/transaction modal, or its page). */
  onOpenTarget: (log: AuditLogEntry) => void;
}

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode; testId?: string }> = ({ title, action, children, testId }) => (
  <section data-testid={testId}>
    <div className="flex items-center justify-between gap-3 mb-2">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const Fact: React.FC<{ label: string; icon?: React.ElementType; children: React.ReactNode; mono?: boolean }> = ({ label, icon: Icon, children, mono }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</dt>
    <dd className={`mt-0.5 text-sm text-gray-900 font-medium break-words flex items-center gap-1.5 ${mono ? 'font-mono text-xs' : ''}`}>
      {Icon && <Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
      {children}
    </dd>
  </div>
);


const EntryList: React.FC<{
  entries: AuditEntrySummary[];
  catalog?: AuditCatalog;
  onOpen: (id: string) => void;
  timeLabel: (entry: AuditEntrySummary) => string;
  showAdmin?: boolean;
  testId: string;
}> = ({ entries, catalog, onOpen, timeLabel, showAdmin, testId }) => (
  <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden" data-testid={testId}>
    {entries.map((entry) => (
      <li key={entry._id}>
        <button
          type="button"
          onClick={() => onOpen(entry._id)}
          className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <AuditActionBadge action={lookupAction(catalog, entry.actionType)} size="sm" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider" title={exactTime(entry.createdAt)}>
                {timeLabel(entry)}
              </span>
            </div>
            <p className="text-xs text-gray-800 mt-1 break-words">{entry.description}</p>
            {showAdmin && entry.admin && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">by {entry.admin.name}</p>}
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 mt-1 flex-shrink-0" />
        </button>
      </li>
    ))}
  </ul>
);

/**
 * Every action by the entry's admin, newest first, ten per page. Opens on the
 * page that holds the entry being viewed — highlighted — so what they did just
 * before and after it is right there; Previous / Next page through the rest.
 */
const AdminHistory: React.FC<{
  adminId: string;
  adminName: string;
  entryId: string;
  /** 0-based index of the viewed entry in the admin's newest-first history. */
  position: number;
  catalog?: AuditCatalog;
  onOpen: (id: string) => void;
  onShowInLog: () => void;
}> = ({ adminId, adminName, entryId, position, catalog, onOpen, onShowInLog }) => {
  const entryPage = Math.floor(position / HISTORY_PAGE_SIZE) + 1;
  const [page, setPage] = useState(entryPage);
  // A different entry (or one that moved) re-centres the list on it.
  useEffect(() => setPage(entryPage), [entryId, entryPage]);

  const { data, isPlaceholderData, isError } = useAuditLogs({ adminId, page, limit: HISTORY_PAGE_SIZE });
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const from = total ? (page - 1) * HISTORY_PAGE_SIZE + 1 : 0;
  const to = Math.min(page * HISTORY_PAGE_SIZE, total);

  return (
    <Section
      title={`All actions by ${adminName}${data ? ` (${total.toLocaleString()})` : ''}`}
      testId="audit-entry-admin-history"
      action={
        <button
          type="button"
          onClick={onShowInLog}
          className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 whitespace-nowrap"
          data-testid="audit-entry-show-admin"
        >
          Show in log <ArrowRight className="h-3 w-3" />
        </button>
      }
    >
      {isError ? (
        <p className="text-xs text-gray-500 rounded-xl border border-dashed border-gray-200 p-3">Couldn't load this admin's actions.</p>
      ) : !data ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-50 border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <ul
            className={`rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
            data-testid="audit-history-list"
          >
            {data.logs.map((item) => {
              const current = item._id === entryId;
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => !current && onOpen(item._id)}
                    aria-current={current ? 'true' : undefined}
                    data-testid="audit-history-item"
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${
                      current ? 'bg-blue-50 shadow-[inset_3px_0_0_0_#2563eb] cursor-default' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AuditActionBadge action={lookupAction(catalog, item.actionType)} size="sm" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider" title={exactTime(item.createdAt)}>
                          {timeAgo(item.createdAt)} · {shortTime(item.createdAt)}
                        </span>
                        {current && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white">
                            Viewing
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 break-words ${current ? 'text-gray-900 font-semibold' : 'text-gray-800'}`}>{item.description}</p>
                    </div>
                    {!current && <ChevronRight className="h-4 w-4 text-gray-300 mt-1 flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2" data-testid="audit-history-pager">
            <p className="text-[11px] text-gray-500">
              Showing <span className="font-semibold text-gray-700">{from}</span>–<span className="font-semibold text-gray-700">{to}</span> of{' '}
              <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> · Page {page} of {pages}
            </p>
            <div className="flex items-center gap-1.5">
              {page !== entryPage && (
                <button
                  type="button"
                  onClick={() => setPage(entryPage)}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 mr-1"
                  data-testid="audit-history-back"
                >
                  Back to this entry
                </button>
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </Section>
  );
};

/**
 * One audit entry in full: what happened, who did it and from where, what it
 * affected as that thing stands now, every value it changed, the other actions
 * on the same thing, and the admin's whole history, paged. Opened by clicking a row; the URL carries the entry
 * (?entry=), so "Copy link" hands another superadmin this exact view.
 */
const AuditEntryPanel: React.FC<AuditEntryPanelProps> = ({ entryId, catalog, onClose, onOpenEntry, onShowAdmin, onShowTarget, onOpenTarget, onOpenReport }) => {
  const { data, isLoading, isError } = useAuditEntry(entryId);
  const historyRef = useRef<HTMLDivElement>(null);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link to this entry copied');
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const header = data ? (
    (() => {
      const { pill, icon: Icon } = groupStyle(data.action.group);
      return (
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pill}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-black text-gray-900 truncate" data-testid="audit-entry-title">{data.action.label}</h2>
              {data.action.sensitive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Sensitive
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 font-medium truncate">
              {[data.action.groupLabel, exactTime(data.log.createdAt), timeAgo(data.log.createdAt)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      );
    })()
  ) : (
    <h2 className="text-lg font-black text-gray-900">Audit entry</h2>
  );

  return (
    <SideModal isOpen={Boolean(entryId)} onClose={onClose} headerContent={header} width="2xl">
      <div className="flex-1 overflow-y-auto" data-testid="audit-entry-panel">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : isError || !data ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 font-medium">This entry couldn't be loaded</p>
            <p className="text-sm text-gray-500 mt-1">It may have been removed, or the link is wrong.</p>
          </div>
        ) : (
          (() => {
            const { log, origin, target, aboutTarget } = data;
            const admin = log.adminId;
            const device = describeDevice(origin.userAgent);
            const location = origin.location && origin.location !== 'Unknown' ? origin.location : null;
            const details = detailEntries(log.metadata);
            const canOpenTarget = Boolean(target?.type && OPENABLE_TARGET_TYPES.has(target.type) && target.exists !== false);
            const selfTarget = target?.id && admin && target.id === String(admin._id);
            return (
              <div className="p-4 md:p-6 space-y-6">
                {/* What happened */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="audit-entry-summary">
                  <p className="text-[15px] text-gray-900 leading-relaxed break-words">{log.description}</p>
                </div>

                {/* Who */}
                <Section
                  title="Done by"
                  testId="audit-entry-admin"
                  action={
                    admin && (
                      <button
                        type="button"
                        onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
                        data-testid="audit-entry-jump-history"
                      >
                        See all their actions <ArrowDown className="h-3 w-3" />
                      </button>
                    )
                  }
                >
                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                        <span className="text-sm font-bold text-blue-600 uppercase">{initials(admin?.name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 truncate">{admin?.name || 'Unknown admin'}</p>
                          {admin?.userType && <UserTypeBadge userType={admin.userType} size="sm" />}
                          {admin?.accountStatus && admin.accountStatus !== 'active' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700">
                              {admin.accountStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{admin?.email}</p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-3 border-t border-dashed border-gray-100">
                      <Fact label="From" icon={Globe}>{location || (origin.ipAddress ? 'Location unknown' : 'Not recorded')}</Fact>
                      <Fact label="Device" icon={Monitor}>{device || 'Not recorded'}</Fact>
                      <Fact label="IP address" icon={Wifi} mono>{origin.ipAddress || 'Not recorded'}</Fact>
                      <Fact label="Their last login">{admin?.lastLogin ? `${timeAgo(admin.lastLogin)} · ${format(new Date(admin.lastLogin), 'MMM d, h:mm a')}` : 'Never'}</Fact>
                    </dl>
                  </div>
                </Section>

                {/* What it affected */}
                {target && !selfTarget && !data.bulk && (
                  <Section
                    title={`Affected ${target.kind.toLowerCase()}`}
                    testId="audit-entry-target"
                    action={
                      canOpenTarget && (
                        <button
                          type="button"
                          onClick={() => onOpenTarget(log)}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
                          data-testid="audit-entry-open-target"
                        >
                          Open {target.kind.toLowerCase()} <MousePointerClick className="h-3 w-3" />
                        </button>
                      )
                    }
                  >
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 break-words">{target.label || target.kind}</p>
                        {target.exists === false && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-600">
                            No longer exists
                          </span>
                        )}
                      </div>
                      {target.facts.length > 0 ? (
                        <>
                          <p className="text-[10px] text-gray-400 font-medium mt-1">As it is now</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 pt-3 border-t border-dashed border-gray-100">
                            {target.facts.map((fact) => (
                              <Fact key={fact.label} label={fact.label}>{fact.value}</Fact>
                            ))}
                          </dl>
                        </>
                      ) : target.exists === false ? (
                        <p className="text-xs text-gray-500 mt-1">The record was deleted after this entry; its name is kept here from the time of the action.</p>
                      ) : null}
                    </div>
                  </Section>
                )}

                {/* Bulk entries: what the batch touched */}
                {data.bulk && (
                  <Section title={`Affected reports (${data.bulk.total.toLocaleString()})`} testId="audit-entry-bulk">
                    <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
                      {data.bulk.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={!item.exists}
                            onClick={() => onOpenReport(item.id)}
                            data-testid="audit-entry-bulk-item"
                            className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 disabled:hover:bg-white disabled:cursor-default"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.label}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">
                                {[item.kind, item.detail].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            {item.status && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-700 flex-shrink-0" title="Status now">
                                {item.status}
                              </span>
                            )}
                            {item.exists && <ChevronRight className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {data.bulk.total > data.bulk.items.length && (
                      <p className="text-[11px] text-gray-500 mt-2">Showing the first {data.bulk.items.length} of {data.bulk.total.toLocaleString()}.</p>
                    )}
                  </Section>
                )}

                {/* What changed */}
                {hasChanges(log.metadata) && (
                  <Section title="What changed" testId="audit-entry-changes">
                    <AuditChangeTable metadata={log.metadata} />
                  </Section>
                )}

                {details.length > 0 && (
                  <Section title="Details recorded" testId="audit-entry-details">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <AuditDetails metadata={log.metadata} />
                    </div>
                  </Section>
                )}

                {/* History */}
                {aboutTarget.length > 0 && target && (
                  <Section
                    title={`Other actions on this ${target.kind.toLowerCase()} (${data.aboutTargetTotal.toLocaleString()})`}
                    action={
                      target.id && (
                        <button
                          type="button"
                          onClick={() => onShowTarget(target.id!, target.label || target.kind)}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
                          data-testid="audit-entry-show-target"
                        >
                          {data.aboutTargetTotal > aboutTarget.length ? 'See all' : 'Show in log'} <ArrowRight className="h-3 w-3" />
                        </button>
                      )
                    }
                  >
                    <EntryList
                      entries={aboutTarget}
                      catalog={catalog}
                      onOpen={onOpenEntry}
                      timeLabel={(entry) => timeAgo(entry.createdAt)}
                      showAdmin
                      testId="audit-entry-about-target"
                    />
                  </Section>
                )}

                {admin && (
                  <div ref={historyRef} className="scroll-mt-4">
                    <AdminHistory
                      adminId={String(admin._id)}
                      adminName={admin.name || 'this admin'}
                      entryId={String(log._id)}
                      position={data.adminHistory.position}
                      catalog={catalog}
                      onOpen={onOpenEntry}
                      onShowInLog={() => onShowAdmin(String(admin._id))}
                    />
                  </div>
                )}
              </div>
            );
          })()
        )}
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
    </SideModal>
  );
};

export default AuditEntryPanel;
