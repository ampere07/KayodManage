import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SidebarContext } from '../components/Layout/Layout';
import { AlertTriangle, Flag, Search, X, Clock, Files, Repeat } from 'lucide-react';
import { ReviewReportModal, TransactionDetailsModal } from '../components/Modals';
import type { ReportDecision } from '../components/Modals/ReviewReportModal';
import { useBulkUpdateReports, useCombinedReports, useUpdateCombinedReport, useUserMutations } from '../hooks';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import CounterGroups from '../components/UI/CounterGroups';
import type { Counter, CounterGroup } from '../components/UI/CounterGroups';
import { ListFooter, SortHeader, ago, selectClass } from '../components/UI/ListControls';
import { ACCOUNT_SIGNAL, Signal, StatusPill } from '../components/Flagged/ReportUI';
import {
  ROLE_LABELS,
  ageLine,
  humanize,
  buildReportIndex,
  isMutual,
  tableOutcome,
  trackRecord,
} from '../components/Flagged/reportInsights';
import { jobsService, transactionsService } from '../services';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Type imports
import type { CombinedReport, ReportSource } from '../services/flaggedService';
import type { Transaction } from '../types';

/** Which collection a row came from — 'all' shows both. */
type SourceFilter = 'all' | ReportSource;

/** What the counters filter by: a status, or the overdue ones still waiting. */
type View = 'all' | 'open' | 'under_review' | 'overdue' | 'action_taken' | 'dismissed' | 'escalated';
const VIEWS: View[] = ['all', 'open', 'under_review', 'overdue', 'action_taken', 'dismissed', 'escalated'];
/** What was reported. Messages, chats and reviews count as Other. */
type TypeFilter = 'all' | 'job' | 'user' | 'other';
const TYPES: TypeFilter[] = ['all', 'job', 'user', 'other'];
const typeOf = (report: CombinedReport): Exclude<TypeFilter, 'all'> =>
  report.reportType === 'job' ? 'job' : report.reportType === 'user' ? 'user' : 'other';

/** The small label above a report's reason. */
const TYPE_LABEL: Record<string, string> = {
  job: 'Job post',
  user: 'User',
  message: 'Message',
  conversation: 'Chat',
  review: 'Review',
  payment: 'Payment',
  other: 'Other',
};

/**
 * How an account action taken from a report is recorded on it. ACTIONS_TAKEN
 * (reportTaxonomy.js, kept byte-identical with kayod/server) has no ban or
 * delete value, so those use user_suspended, and adminNotes records exactly
 * what was done (outcomeOf reads it back for the table).
 */
const USER_ACTION_OUTCOMES = {
  restrict: { actionTaken: 'user_restricted', label: 'User restricted' },
  suspend: { actionTaken: 'user_suspended', label: 'User suspended' },
  ban: { actionTaken: 'user_suspended', label: 'User banned' },
  delete: { actionTaken: 'user_suspended', label: 'User deleted' },
} as const;

/**
 * Bulk triage. Only reports still open or under review change — the server skips
 * anything already closed — and none of these touch a post or an account: those
 * stay one report at a time, in the review modal, where the evidence is.
 */
type BulkAction = 'under_review' | 'dismissed' | 'action_taken';
const BULK_ACTIONS: Record<BulkAction, { label: string; done: string; tone: 'danger' | 'default'; explain: string }> = {
  under_review: {
    label: 'Mark under review',
    done: 'Marked under review',
    tone: 'default',
    explain: 'Tells the team these are being looked at. Nothing changes for the reporter or the person reported.',
  },
  dismissed: {
    label: 'Dismiss',
    done: 'Dismissed',
    tone: 'danger',
    explain: "Closes them with no action against anyone. Use for reports that don't break the rules.",
  },
  action_taken: {
    label: 'Mark resolved',
    done: 'Resolved',
    tone: 'default',
    explain: 'Closes them as handled. No post or account action is taken here — use it when the issue was dealt with elsewhere.',
  },
};
// Matches the server's per-request cap (reportController bulkUpdateReportStatus).
const BULK_LIMIT = 500;
const selectionKey = (report: CombinedReport) => `${report.source}:${report._id}`;
const isAwaitingDecision = (report: CombinedReport) => report.status === 'open' || report.status === 'under_review';

const AGE_TONE = { urgent: 'text-red-600', warn: 'text-amber-600', muted: 'text-gray-500' } as const;
/** Account-type colours, as on the Users and Jobs rows. */
const ROLE_TONE: Record<string, string> = { client: 'text-purple-600', provider: 'text-indigo-600' };

/** A reporter needs this many reports here before the count is worth a flag. */
const SERIAL_REPORTER = 3;

/** Most accounts sign up with a phone number and have no email on file. */
const contactOf = (party?: { email?: string; phoneNumber?: string } | null) =>
  party?.email || party?.phoneNumber || '';

/** Waiting longer than the overdue threshold (reportInsights.OVERDUE_DAYS). */
const isOverdue = (report: CombinedReport) => isAwaitingDecision(report) && ageLine(report)?.tone === 'urgent';

/**
 * Flagged — every report about a person, a job post or a message, from both
 * the `reports` and `reportedposts` collections. The same counters, rows and
 * footer as the other list pages: where each report stands, what's overdue,
 * and what was reported; every number is the rows clicking it shows. Status
 * and type live in the URL; ?reportId= opens one report.
 */
const Flagged: React.FC = () => {
  // Reads `reports` and `reportedposts` together — see useCombinedReports.
  const { data: reportsData, isLoading } = useCombinedReports();
  const updateReportMutation = useUpdateCombinedReport();
  const bulkMutation = useBulkUpdateReports();
  const mutations = useUserMutations();

  const allReports = reportsData?.reports || [];

  const reports = useMemo(() => {
    return allReports.filter((report: CombinedReport) => {
      const type = (report.reportType || '').toLowerCase();
      const reason = (report.reason || '').toLowerCase();
      const comment = (report.comment || '').toLowerCase();

      const isRefundRelated =
        type.includes('refund') ||
        type.includes('payment') ||
        reason.includes('refund') ||
        reason.includes('payment') ||
        comment.includes('refund') ||
        comment.includes('payment');

      return !isRefundRelated;
    });
  }, [allReports]);

  const reportIndex = useMemo(() => buildReportIndex(reports), [reports]);

  /** Flags on the reported person: their account status and repeat reports. */
  const reportedSignals = (report: CombinedReport) => {
    const party = report.reportedUserId;
    if (!party) return [];
    const against = (reportIndex.against.get(party._id) || []).length;
    const account = party.accountStatus && party.accountStatus !== 'active' ? ACCOUNT_SIGNAL[party.accountStatus] : null;
    const signals: React.ReactNode[] = [];
    if (account) {
      signals.push(<Signal key="account" icon={account.icon} tone={account.tone} title={`Account is ${account.label.toLowerCase()} right now`}>{account.label}</Signal>);
    }
    if (against > 1) {
      signals.push(
        <Signal key="repeat" icon={Flag} tone={against >= 3 ? 'red' : 'amber'} title={`${against} reports on this page name this person`}>
          Reported {against}×
        </Signal>
      );
    }
    return signals;
  };

  /** Flags on the reporter: serial reporting and reports in both directions. */
  const reporterSignals = (report: CombinedReport) => {
    const party = report.reportedBy;
    if (!party) return [];
    const record = trackRecord(reportIndex.filedBy.get(party._id));
    const signals: React.ReactNode[] = [];
    if (record.total >= SERIAL_REPORTER) {
      const mostlyDismissed = record.dismissed >= 3 && record.dismissed >= 3 * record.actioned;
      signals.push(
        <Signal
          key="filed"
          icon={Files}
          tone={mostlyDismissed ? 'amber' : 'slate'}
          title={`Filed ${record.total} reports: ${record.dismissed} dismissed, ${record.actioned} actioned, ${record.awaiting} awaiting`}
        >
          Filed {record.total}
        </Signal>
      );
    }
    if (isMutual(report, reportIndex)) {
      signals.push(
        <Signal key="mutual" icon={Repeat} tone="violet" title="The person reported has also reported this reporter — often a dispute spilling over">
          Mutual report
        </Signal>
      );
    }
    return signals;
  };

  const [selectedReport, setSelectedReport] = useState<CombinedReport | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  // Oldest first works the queue in the order reports came in.
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<Map<string, CombinedReport>>(new Map());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkNote, setBulkNote] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [, setIsFetchingTransaction] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  // Status and type live in the URL; they combine.
  const viewParam = (searchParams.get('status') || 'all') as View;
  const view: View = VIEWS.includes(viewParam) ? viewParam : 'all';
  const typeParam = (searchParams.get('type') || 'all') as TypeFilter;
  const typeFilter: TypeFilter = TYPES.includes(typeParam) ? typeParam : 'all';
  const setFilters = (nextView: View, nextType: TypeFilter) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === 'all') next.delete('status'); else next.set('status', nextView);
    if (nextType === 'all') next.delete('type'); else next.set('type', nextType);
    setSearchParams(next, { replace: true });
  };
  // Clicking the selected counter again lifts that filter.
  const chooseView = (next: View) => setFilters(next === view ? 'all' : next, typeFilter);
  const chooseType = (next: TypeFilter) => setFilters(view, next === typeFilter ? 'all' : next);

  const { setIsHeaderHidden } = useContext(SidebarContext);

  useEffect(() => {
    if (setIsHeaderHidden) {
      setIsHeaderHidden(isModalOpen);
    }
  }, [isModalOpen, setIsHeaderHidden]);

  useEffect(() => {
    const reportId = searchParams.get('reportId');
    const alertId = searchParams.get('alertId');
    const targetId = reportId || alertId;

    if (targetId && reports.length > 0) {
      const report = reports.find((p: CombinedReport) => p._id === targetId);
      if (report) {
        setHighlightedPostId(targetId);
        setSelectedReport(report);
        setIsModalOpen(true);

        setTimeout(() => {
          highlightedRowRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300);

        searchParams.delete('reportId');
        searchParams.delete('alertId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [reports, searchParams, setSearchParams]);

  const handleUpdateReport = async (
    reportId: string,
    source: ReportSource,
    status: string,
    action: string = 'none',
    adminNotes: string = ''
  ) => {
    setActionLoading(true);
    try {
      await updateReportMutation.mutateAsync({
        reportId,
        source,
        status,
        adminNotes,
        actionTaken: action
      });
      setIsModalOpen(false);
      setSelectedReport(null);
      toast.success(
        status === 'action_taken' ? 'Report resolved'
        : status === 'dismissed' ? 'Report dismissed'
        : 'Report updated'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update report');
    } finally {
      setActionLoading(false);
    }
  };

  /** Joins a fixed outcome line with what the admin typed, so outcomeOf can still read the outcome. */
  const withNotes = (base: string, notes: string) => (notes ? (base ? `${base} — ${notes}` : notes) : base);

  const handleReview = async (action: ReportDecision, notes: string) => {
    if (!selectedReport) return;

    if (action === 'delete') {
      // "Delete Post" takes the job down first — the same admin delete as Job
      // Details: gone from the app for everyone, poster notified, restorable from
      // Archived Jobs — and closes the report only once that has worked.
      const job = selectedReport.job;
      const alreadyGone = !job?._id || job.isDeleted;
      if (job && !alreadyGone) {
        if (!window.confirm(`Delete “${job.title}”? It will be removed from the app for everyone and the poster will be notified. You can restore it from Archived Jobs.`)) {
          return;
        }
        setActionLoading(true);
        try {
          await jobsService.deleteJob(job._id);
        } catch {
          // The API client already shows the server's reason (for example, the
          // job has a live booking). The report stays open for another decision.
          setActionLoading(false);
          return;
        }
      }
      await handleUpdateReport(
        selectedReport._id,
        selectedReport.source,
        'action_taken',
        'post_deleted',
        withNotes(alreadyGone ? 'Post was already removed' : `Post deleted: ${job?.title}`, notes)
      );
      return;
    }

    const decisions = {
      approve: { status: 'action_taken', actionTaken: 'post_approved' },
      dismiss: { status: 'dismissed', actionTaken: 'report_dismissed' },
      resolve: { status: 'action_taken', actionTaken: 'none' },
    } as const;
    const decision = decisions[action];
    await handleUpdateReport(selectedReport._id, selectedReport.source, decision.status, decision.actionTaken, notes);
  };

  const handleViewReport = async (report: CombinedReport) => {
    const reportType = (report.reportType || '').toLowerCase();
    const reason = (report.reason || '').toLowerCase();
    const isPotentialRefund = reportType === 'payment' || reportType === 'refund_request' || reason.includes('refund');

    if (isPotentialRefund && report.relatedId) {
      setIsFetchingTransaction(true);
      try {
        let transaction = null;
        // Not every relatedId is a transaction id; fall through to the job lookup.
        try { transaction = await transactionsService.getTransactionById(report.relatedId); } catch { /* try the job lookup below */ }
        if (!transaction) {
          const res = await transactionsService.getTransactions({ jobId: report.relatedId, limit: 10 });
          transaction = res.transactions.find(t => t.type === 'refund_request' || t.type === 'refund');
        }
        if (transaction) {
          setSelectedTransaction(transaction as any);
          setIsTransactionModalOpen(true);
          return;
        }
      } catch { /* fall through to the plain report modal */ } finally { setIsFetchingTransaction(false); }
    }
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  // Source and search narrow the counters as well as the list.
  const searched = useMemo(() => {
    let list = reports;
    if (sourceFilter !== 'all') list = list.filter((r: CombinedReport) => r.source === sourceFilter);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      // Every field is optional-guarded: legacy rows copied into `reports` carry
      // no reportType at all, and an unguarded .toLowerCase() threw on them.
      list = list.filter((r: CombinedReport) =>
        (r.reportType || '').toLowerCase().includes(s) ||
        (r.reportedBy?.name || '').toLowerCase().includes(s) ||
        contactOf(r.reportedBy).toLowerCase().includes(s) ||
        contactOf(r.reportedUserId).toLowerCase().includes(s) ||
        (r.reason || '').toLowerCase().includes(s) ||
        (r.comment || '').toLowerCase().includes(s) ||
        (r.job?.title || '').toLowerCase().includes(s) ||
        (r.reportedUserId?.name || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [reports, sourceFilter, searchTerm]);

  const matchesView = (r: CombinedReport, v: View) => v === 'all' || (v === 'overdue' ? isOverdue(r) : r.status === v);
  const matchesType = (r: CombinedReport, t: TypeFilter) => t === 'all' || typeOf(r) === t;
  const countWhere = (v: View, t: TypeFilter) => searched.filter((r) => matchesView(r, v) && matchesType(r, t)).length;

  const filteredReports = useMemo(() => {
    const list = searched.filter((r) => matchesView(r, view) && matchesType(r, typeFilter));
    const time = (r: CombinedReport) => new Date(r.createdAt).getTime() || 0;
    return [...list].sort((a, b) => (sortOrder === 'oldest' ? time(a) - time(b) : time(b) - time(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, view, typeFilter, sortOrder]);

  // Narrowing the result set can strand you past the last page, showing an
  // empty table over a non-empty list.
  // A selection made under other filters would act on rows no longer in view.
  useEffect(() => {
    setCurrentPage(1);
    setSelected(new Map());
  }, [view, typeFilter, sourceFilter, searchTerm, itemsPerPage, sortOrder]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

  const pageSelectable = paginatedReports.filter(isAwaitingDecision);
  const viewSelectable = filteredReports.filter(isAwaitingDecision);
  const pageAllSelected = pageSelectable.length > 0 && pageSelectable.every((r) => selected.has(selectionKey(r)));
  const pageSomeSelected = pageSelectable.some((r) => selected.has(selectionKey(r)));
  const toggleSelected = (report: CombinedReport) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const key = selectionKey(report);
      if (next.has(key)) next.delete(key);
      else if (next.size < BULK_LIMIT) next.set(key, report);
      else toast.error(`Up to ${BULK_LIMIT} reports at a time`);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) pageSelectable.forEach((r) => next.delete(selectionKey(r)));
      else pageSelectable.forEach((r) => next.size < BULK_LIMIT && next.set(selectionKey(r), r));
      return next;
    });
  const selectWholeView = () =>
    setSelected(new Map(viewSelectable.slice(0, BULK_LIMIT).map((r) => [selectionKey(r), r])));

  const runBulk = async () => {
    if (!bulkAction) return;
    const items = [...selected.values()].map((r) => ({ id: r._id, source: r.source }));
    try {
      const result = await bulkMutation.mutateAsync({ items, status: bulkAction, adminNotes: bulkNote.trim() || undefined });
      const parts = [`${BULK_ACTIONS[bulkAction].done} ${result.updated} report${result.updated === 1 ? '' : 's'}`];
      if (result.skipped.length) parts.push(`${result.skipped.length} skipped (already closed or changed)`);
      if (result.failed.length) toast.error(`${result.failed.length} couldn't be updated — try them one at a time`);
      if (result.updated || result.skipped.length) toast.success(parts.join(' · '));
      setSelected(new Map());
      setBulkAction(null);
      setBulkNote('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Bulk update failed');
    }
  };

  // ── Counters ─────────────────────────────────────────────────────────────
  const viewCell = (key: View, label: string, tone: Counter['tone'], hint: string, extra: Partial<Counter> = {}): Counter => ({
    key,
    label,
    tone,
    hint,
    count: isLoading ? undefined : countWhere(key, typeFilter),
    selected: view === key,
    onClick: () => chooseView(key),
    ...extra,
  });
  const typeCell = (key: Exclude<TypeFilter, 'all'>, label: string, tone: Counter['tone'], hint: string): Counter => ({
    key,
    label,
    tone,
    hint,
    count: isLoading ? undefined : countWhere(view, key),
    selected: typeFilter === key,
    onClick: () => chooseType(key),
  });
  const waitingTotal = countWhere('open', typeFilter) + countWhere('under_review', typeFilter);
  const closedTotal = countWhere('action_taken', typeFilter) + countWhere('dismissed', typeFilter) + countWhere('escalated', typeFilter);
  const groups: CounterGroup[] = [
    {
      label: 'Waiting',
      total: isLoading ? undefined : waitingTotal,
      cells: [
        viewCell('open', 'Open', 'amber', 'Nobody has looked at these yet'),
        viewCell('under_review', 'Under review', 'blue', 'An admin is looking into these', { shortLabel: 'Reviewing' }),
      ],
    },
    {
      label: 'Closed',
      total: isLoading ? undefined : closedTotal,
      cells: [
        viewCell('action_taken', 'Resolved', 'emerald', 'Closed with action: a post deleted or kept, or an account restricted'),
        viewCell('dismissed', 'Dismissed', 'gray', 'Closed with no action'),
        viewCell('escalated', 'Escalated', 'orange', 'Sent on to a job dispute'),
      ],
    },
    {
      label: 'Needs a look',
      cells: [viewCell('overdue', 'Overdue', 'red', 'Waiting more than 7 days for a decision', { alert: true })],
    },
    {
      label: 'Reported',
      cells: [
        typeCell('job', 'Jobs', 'orange', 'Reports about a job post'),
        typeCell('user', 'Users', 'purple', 'Reports about a person'),
        typeCell('other', 'Other', 'gray', 'Messages, chats and reviews'),
      ],
    },
  ];

  const anyFilterActive = Boolean(searchTerm) || view !== 'all' || typeFilter !== 'all' || sourceFilter !== 'all' || sortOrder !== 'newest';
  const clearFilters = () => {
    setSearchTerm('');
    setSourceFilter('all');
    setSortOrder('newest');
    setFilters('all', 'all');
  };
  const waitingAll = reports.filter(isAwaitingDecision).length;
  const overdueAll = reports.filter(isOverdue).length;
  const emptyText = (view === 'open' || view === 'overdue') && !searchTerm
    ? { title: view === 'overdue' ? 'Nothing overdue' : 'Nothing waiting', text: 'Every report in this view has a decision.' }
    : { title: 'No reports found', text: 'Try adjusting your search or filters.' };

  /** The one line under a report's status: how long it has waited, or what was decided and by whom. */
  const statusLine = (report: CombinedReport): { text: string; tone: string; title?: string } => {
    const age = ageLine(report);
    if (isAwaitingDecision(report)) {
      return age
        ? { text: age.tone === 'urgent' ? `Overdue · ${age.text.toLowerCase()}` : age.text, tone: AGE_TONE[age.tone] }
        : { text: `Reported ${ago(report.createdAt)}`, tone: 'text-gray-500' };
    }
    const outcome = tableOutcome(report);
    const by = report.reviewedBy?.name ? `by ${report.reviewedBy.name}` : '';
    return {
      text: [outcome, by].filter(Boolean).join(' · ') || (report.reviewedAt ? `Decided ${format(new Date(report.reviewedAt), 'MMM d')}` : 'Decided'),
      tone: 'text-gray-500',
      title: report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : undefined,
    };
  };

  /**
   * One person in their own column (the header says which part they play):
   * account type, name, and the most important flag on them.
   */
  const partyCell = (role: 'reported' | 'reporter', report: CombinedReport) => {
    const party = role === 'reported' ? report.reportedUserId : report.reportedBy;
    const signals = role === 'reported' ? reportedSignals(report) : reporterSignals(report);
    return (
      <div className="min-w-0" data-testid={role === 'reported' ? 'flagged-reported-user' : 'flagged-reporter'} title={[party?.name, contactOf(party)].filter(Boolean).join(' · ') || undefined}>
        {party?.userType && (
          <p className={`text-[9px] font-black uppercase tracking-wider truncate ${ROLE_TONE[party.userType] || 'text-gray-400'}`}>
            {ROLE_LABELS[party.userType] || party.userType}
          </p>
        )}
        <p className={`text-sm truncate ${party?.name ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
          {party?.name || (role === 'reported' ? 'No account linked' : 'Unknown')}
        </p>
        {signals.length > 0 && (
          <div className="mt-0.5 truncate" data-testid={role === 'reported' ? 'flagged-reported-chips' : 'flagged-reporter-chips'}>{signals[0]}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Flagged Content
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {isLoading ? 'Reports about people, job posts and messages' : `${reports.length.toLocaleString()} reports about people, job posts and messages`}
                {!isLoading && waitingAll > 0 && <span className="text-amber-600 font-semibold"> · {waitingAll} waiting for a decision</span>}
                {!isLoading && overdueAll > 0 && <span className="text-red-600 font-semibold"> · {overdueAll} overdue</span>}
              </p>
            </div>
          </div>

          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.75fr_2.2fr_3.3fr_1.4fr_2.35fr] xl:grid-cols-[0.7fr_2.55fr_3.3fr_1fr_2.45fr]"
            all={{ count: isLoading ? undefined : searched.length, selected: view === 'all' && typeFilter === 'all', onClick: () => setFilters('all', 'all') }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="flagged-counters"
            idPrefix="flagged"
            allCell={{ label: 'All', hint: 'Every report under the source and search filters' }}
          />
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it; from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <input
              type="text"
              data-testid="flagged-search"
              placeholder="Search by keywords, reporter, or reported user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto lg:flex lg:items-center">
            {/* `reports` and `reportedposts` are separate collections merged into this one list. */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              aria-label="Where the report is stored"
              data-testid="flagged-source"
              className={`${selectClass} lg:w-[190px]`}
            >
              <option value="all">All sources</option>
              <option value="report">Reports</option>
              <option value="reported_post">Reported posts</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              aria-label="Sort reports"
              data-testid="flagged-sort"
              className={`${selectClass} lg:w-[130px] xl:hidden`}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              aria-label="Reports per page"
              className={`${selectClass} lg:hidden`}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading reports...</p>
              </div>
            </div>
          ) : paginatedReports.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="flagged-empty">
              <div className="text-gray-300 mb-4">
                <Flag className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">{emptyText.title}</p>
              <p className="text-sm text-gray-500 mt-1">{emptyText.text}</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show every report
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className="w-12 pl-6 pr-2 py-3.5 border-b border-gray-200">
                        <input
                          type="checkbox"
                          aria-label="Select every report on this page that needs review"
                          data-testid="flagged-select-page"
                          checked={pageAllSelected}
                          ref={(el) => { if (el) el.indeterminate = !pageAllSelected && pageSomeSelected; }}
                          disabled={pageSelectable.length === 0}
                          onChange={togglePage}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 cursor-pointer"
                        />
                      </th>
                      {/* No width: Report takes what's left, so hiding Submitted below xl widens it, not the checkbox. */}
                      <th className="px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Report</th>
                      <th className="w-[19%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported user</th>
                      <th className="w-[16%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported by</th>
                      <th className="w-[20%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Status</th>
                      <th
                        className="hidden xl:table-cell w-[15%] px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sortOrder === 'newest' ? 'descending' : 'ascending'}
                      >
                        <SortHeader
                          label="Submitted"
                          dir={sortOrder === 'newest' ? 'desc' : 'asc'}
                          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedReports.map((report) => {
                      const line = statusLine(report);
                      const postGone = report.job?.isDeleted || report.job?.isHidden;
                      return (
                        <tr
                          key={report._id}
                          ref={highlightedPostId === report._id ? highlightedRowRef : null}
                          onClick={() => handleViewReport(report)}
                          data-testid="flagged-row"
                          className={`group h-20 cursor-pointer transition-colors ${highlightedPostId === report._id ? 'bg-amber-50/70' : selected.has(selectionKey(report)) ? 'bg-blue-50/60' : 'hover:bg-gray-50/70'}`}
                        >
                          <td className="pl-6 pr-2 py-2 align-middle border-b border-gray-200" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={isAwaitingDecision(report) ? 'Select report' : 'Already closed'}
                              title={isAwaitingDecision(report) ? undefined : 'Already closed — open it to see the decision'}
                              data-testid="flagged-select"
                              checked={selected.has(selectionKey(report))}
                              disabled={!isAwaitingDecision(report)}
                              onChange={() => toggleSelected(report)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 xl:px-6 py-2 h-20 align-middle border-b border-gray-200">
                            <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 truncate">
                              {TYPE_LABEL[report.reportType] || 'Other'}
                              {postGone && (
                                <span className="text-red-600"> · {report.job?.isDeleted ? 'Post deleted' : 'Post hidden'}</span>
                              )}
                            </p>
                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{humanize(report.reason) || 'Other'}</p>
                            <p className="text-[11px] text-gray-500 truncate" title={report.job?.title || report.comment || undefined}>
                              {report.job?.title ? report.job.title : report.comment ? `“${report.comment}”` : <span className="italic text-gray-400">No comment</span>}
                            </p>
                          </td>
                          <td className="px-4 xl:px-6 py-2 h-20 align-middle border-b border-gray-200">
                            {partyCell('reported', report)}
                          </td>
                          <td className="px-4 xl:px-6 py-2 h-20 align-middle border-b border-gray-200">
                            {partyCell('reporter', report)}
                          </td>
                          <td className="px-4 xl:px-6 py-2 h-20 align-middle border-b border-gray-200">
                            <div className="flex flex-col items-start gap-1.5 min-w-0">
                              <StatusPill status={report.status} testId="flagged-status" />
                              <span
                                className={`flex items-center gap-1 max-w-full text-[11px] ${line.tone}`}
                                title={line.title}
                                data-testid={isAwaitingDecision(report) ? 'flagged-age' : 'flagged-outcome'}
                              >
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{line.text}</span>
                              </span>
                            </div>
                          </td>
                          <td className="hidden xl:table-cell px-6 py-2 h-20 align-middle border-b border-gray-200">
                            <p className="text-xs font-bold text-gray-900 truncate" data-testid="flagged-age-time" title={new Date(report.createdAt).toLocaleString()}>{ago(report.createdAt)}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-1" data-testid="flagged-date">{format(new Date(report.createdAt), 'MMM d, yyyy')}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones and tablets */}
              <div className="lg:hidden bg-white">
                <div className="px-3 py-3 space-y-2">
                  {paginatedReports.map((report) => {
                    const line = statusLine(report);
                    return (
                      <div
                        key={report._id}
                        onClick={() => handleViewReport(report)}
                        data-testid="flagged-card"
                        className={`bg-white rounded-xl border shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer ${selected.has(selectionKey(report)) ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}
                      >
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                          {isAwaitingDecision(report) ? (
                            <input
                              type="checkbox"
                              aria-label="Select report"
                              checked={selected.has(selectionKey(report))}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelected(report)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                            />
                          ) : (
                            <span className="w-4 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 truncate">{TYPE_LABEL[report.reportType] || 'Other'}</p>
                            <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{humanize(report.reason) || 'Other'}</p>
                            <p className="mt-0.5 text-[11px] text-gray-500 truncate">
                              <span className="font-semibold text-gray-700">{report.reportedUserId?.name || report.job?.title || 'No account'}</span>
                              {' '}reported by {report.reportedBy?.name || 'unknown'}
                            </p>
                          </div>
                          <StatusPill status={report.status} className="flex-shrink-0 !text-[9px] !px-2" />
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <p className={`flex-1 min-w-0 text-[10px] font-semibold truncate ${line.tone}`}>{line.text}</p>
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {ago(report.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bulk triage — appears once reports are selected */}
        {selected.size > 0 && (
          <div className="flex-shrink-0 bg-blue-600 text-white px-4 md:px-6 py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 z-20" data-testid="flagged-bulk-bar">
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-sm font-black whitespace-nowrap">
                {selected.size} selected
              </p>
              {pageAllSelected && viewSelectable.length > selected.size && selected.size < BULK_LIMIT && (
                <button type="button" onClick={selectWholeView} className="text-xs font-bold underline underline-offset-2 text-blue-100 hover:text-white truncate">
                  Select all {Math.min(viewSelectable.length, BULK_LIMIT)} needing review in this view
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              {(Object.keys(BULK_ACTIONS) as BulkAction[]).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => setBulkAction(action)}
                  data-testid={`flagged-bulk-${action}`}
                  className="px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-white/10 hover:bg-white/20 border border-white/30 whitespace-nowrap"
                >
                  {BULK_ACTIONS[action].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected(new Map())}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-blue-100 hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>
        )}

        {!isLoading && filteredReports.length > 0 && (
          <ListFooter page={currentPage} limit={itemsPerPage} total={filteredReports.length} pages={totalPages} onPage={setCurrentPage} onLimit={setItemsPerPage} />
        )}
      </div>

      <ReviewReportModal
        isOpen={isModalOpen && !!selectedReport}
        onClose={() => { setIsModalOpen(false); setSelectedReport(null); }}
        report={selectedReport}
        allReports={reports}
        onOpenReport={(next) => setSelectedReport(next)}
        onReview={handleReview}
        isLoading={actionLoading}
        onUserAction={async (userId, actionType, duration, reason, notes) => {
          const report = selectedReport;
          if (!report) return;
          // The mutation hooks toast success and failure themselves. A failure
          // propagates so the modal keeps the report open with the admin's input.
          switch (actionType) {
            case 'restrict': await mutations.restrictUser.mutateAsync({ userId, duration: duration || 0, reason: reason || 'Restricted by admin' }); break;
            case 'suspend': await mutations.suspendUser.mutateAsync({ userId, reason: reason || 'Suspended by admin', duration: duration || 7 }); break;
            case 'ban': await mutations.banUser.mutateAsync({ userId, reason: reason || 'Banned by admin', duration: duration || 0 }); break;
            case 'delete': await mutations.softDeleteUser.mutateAsync({ userId, reason: reason || 'Deleted by admin' }); break;
          }
          const outcome = USER_ACTION_OUTCOMES[actionType];
          await handleUpdateReport(
            report._id,
            report.source,
            'action_taken',
            outcome.actionTaken,
            withNotes(`${outcome.label}: ${reason || 'no reason given'}`, notes || '')
          );
        }}
      />

      <ConfirmDialog
        isOpen={bulkAction !== null}
        title={bulkAction ? `${BULK_ACTIONS[bulkAction].label} — ${selected.size} report${selected.size === 1 ? '' : 's'}?` : ''}
        tone={bulkAction ? BULK_ACTIONS[bulkAction].tone : 'default'}
        confirmLabel={bulkAction ? BULK_ACTIONS[bulkAction].label : 'Confirm'}
        isLoading={bulkMutation.isPending}
        onCancel={() => { if (!bulkMutation.isPending) { setBulkAction(null); setBulkNote(''); } }}
        onConfirm={runBulk}
        message={
          bulkAction && (
            <div className="space-y-3">
              <p>{BULK_ACTIONS[bulkAction].explain}</p>
              <p className="text-xs text-gray-500">Reports already closed by someone else are skipped, not overwritten. This is recorded in the audit log.</p>
              <label className="block">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Note for the record (optional)</span>
                <textarea
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. Duplicate reports about the same post"
                  data-testid="flagged-bulk-note"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </label>
            </div>
          )
        }
      />

      <TransactionDetailsModal
        isOpen={isTransactionModalOpen}
        onClose={() => { setIsTransactionModalOpen(false); setSelectedTransaction(null); }}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Flagged;
