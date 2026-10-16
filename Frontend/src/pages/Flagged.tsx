import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SidebarContext } from '../components/Layout/Layout';
import {
  AlertTriangle,
  Eye,
  Calendar,
  Search,
  Image as ImageIcon,
  Briefcase,
  CheckCircle,
  XCircle,
  Flag,
  MessageSquare,
  Users,
  CreditCard,
  Star,
  ChevronRight,
  Inbox,
  X,
  AlertCircle,
  EyeOff,
  Files,
  Repeat,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ReviewReportModal, TransactionDetailsModal } from '../components/Modals';
import type { ReportDecision } from '../components/Modals/ReviewReportModal';
import { useBulkUpdateReports, useCombinedReports, useUpdateCombinedReport, useUserMutations } from '../hooks';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { ACCOUNT_SIGNAL, PartyAvatar, Signal, StatusPill } from '../components/Flagged/ReportUI';
import {
  ageLine,
  humanize,
  buildReportIndex,
  isMutual,
  tableOutcome,
  trackRecord,
} from '../components/Flagged/reportInsights';
import { jobsService, transactionsService } from '../services';
import toast from 'react-hot-toast';
import { formatDistanceToNowStrict } from 'date-fns';
import StatsCard from '../components/Dashboard/StatsCard';

// Type imports
import type { ReportFilterStatus } from '../types/alerts.types';
import type { CombinedReport, ReportSource } from '../services/flaggedService';
import type { Transaction } from '../types';

/** Which collection a row came from — 'all' shows both. */
type SourceFilter = 'all' | ReportSource;

/** What is being reported, independent of which collection stores it. */
type ReportTypeFilter = 'all' | 'job' | 'user';

/**
 * The counter row. These slice on two different axes — "Reported Jobs"/"Reported
 * Users" filter by what was reported, "Resolved"/"Dismissed" by status — so
 * each card sets both axes and only one can be active at a time.
 */
const STAT_CARDS: {
  key: string;
  title: string;
  statKey: 'needs_review' | 'total' | 'job' | 'user' | 'action_taken' | 'dismissed';
  status: ReportFilterStatus;
  type: ReportTypeFilter;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'red' | 'indigo' | 'orange';
}[] = [
  { key: 'needs_review', title: 'Needs Review',   statKey: 'needs_review', status: 'needs_review', type: 'all',  icon: Inbox,       color: 'red'    },
  { key: 'all',          title: 'Total Reports',  statKey: 'total',        status: 'all',          type: 'all',  icon: Flag,        color: 'blue'   },
  { key: 'job',          title: 'Reported Jobs',  statKey: 'job',          status: 'all',          type: 'job',  icon: Briefcase,   color: 'orange' },
  { key: 'user',         title: 'Reported Users', statKey: 'user',         status: 'all',          type: 'user', icon: Users,       color: 'purple' },
  { key: 'action_taken', title: 'Resolved',       statKey: 'action_taken', status: 'action_taken', type: 'all',  icon: CheckCircle, color: 'green'  },
  { key: 'dismissed',    title: 'Dismissed',      statKey: 'dismissed',    status: 'dismissed',    type: 'all',  icon: XCircle,     color: 'indigo' },
];

const SOURCE_BADGES: Record<ReportSource, { label: string; className: string }> = {
  report: { label: 'Reports', className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  reported_post: { label: 'Reported Posts', className: 'bg-teal-50 text-teal-700 border-teal-100' },
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

const AGE_TONE = { urgent: 'text-red-600', warn: 'text-amber-600', muted: 'text-gray-900' } as const;

/** A reporter needs this many reports here before the count is worth a chip. */
const SERIAL_REPORTER = 3;

/** Most accounts sign up with a phone number and have no email on file. */
const contactOf = (party?: { email?: string; phoneNumber?: string } | null) =>
  party?.email || party?.phoneNumber || '';

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

  const stats = useMemo(() => {
    return {
      total: reports.length,
      open: reports.filter((r: CombinedReport) => r.status === 'open').length,
      under_review: reports.filter((r: CombinedReport) => r.status === 'under_review').length,
      action_taken: reports.filter((r: CombinedReport) => r.status === 'action_taken').length,
      dismissed: reports.filter((r: CombinedReport) => r.status === 'dismissed').length,
      escalated: reports.filter((r: CombinedReport) => r.status === 'escalated').length,
      report: reports.filter((r: CombinedReport) => r.source === 'report').length,
      reported_post: reports.filter((r: CombinedReport) => r.source === 'reported_post').length,
      // Reported jobs come from both collections: every `reportedposts` row plus
      // the legacy job-shaped rows sitting in `reports`.
      job: reports.filter((r: CombinedReport) => r.reportType === 'job').length,
      user: reports.filter((r: CombinedReport) => r.reportType === 'user').length,
    };
  }, [reports]);

  const [selectedReport, setSelectedReport] = useState<CombinedReport | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>('all');
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
  const [isFetchingTransaction, setIsFetchingTransaction] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

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

  const statusCounts = useMemo(() => ({
    all: stats.total,
    total: stats.total,
    open: stats.open,
    under_review: stats.under_review,
    action_taken: stats.action_taken,
    dismissed: stats.dismissed,
    escalated: stats.escalated,
    job: stats.job,
    user: stats.user,
    // Everything still awaiting an admin — mirrors OPEN_REPORT_STATUSES /
    // open_total in Backend/app/constants/reportTaxonomy.js.
    needs_review: stats.open + stats.under_review
  }), [stats]);

  /**
   * A counter card owns both axes, so selecting one clears the other. Clicking the
   * active card again goes back to everything (the desktop row has no Total card).
   */
  const selectStatCard = (card: (typeof STAT_CARDS)[number]) => {
    const next = card.key !== 'all' && filter === card.status && typeFilter === card.type
      ? STAT_CARDS.find((c) => c.key === 'all')!
      : card;
    setFilter(next.status);
    setTypeFilter(next.type);
  };

  const isStatCardActive = (card: (typeof STAT_CARDS)[number]) =>
    filter === card.status && typeFilter === card.type;

  const filteredReports = useMemo(() => {
    let filtered = reports;
    if (filter === 'needs_review') filtered = filtered.filter(isAwaitingDecision);
    else if (filter !== 'all') filtered = filtered.filter((r: CombinedReport) => r.status === filter);
    if (typeFilter !== 'all') filtered = filtered.filter((r: CombinedReport) => r.reportType === typeFilter);
    if (sourceFilter !== 'all') filtered = filtered.filter((r: CombinedReport) => r.source === sourceFilter);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      // Every field is optional-guarded: legacy rows copied into `reports` carry
      // no reportType at all, and an unguarded .toLowerCase() threw on them.
      filtered = filtered.filter((r: CombinedReport) =>
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
    const time = (r: CombinedReport) => new Date(r.createdAt).getTime() || 0;
    return [...filtered].sort((a, b) => (sortOrder === 'oldest' ? time(a) - time(b) : time(b) - time(a)));
  }, [reports, filter, typeFilter, sourceFilter, searchTerm, sortOrder]);

  // Narrowing the result set can strand you past the last page, showing an
  // empty table over a non-empty list.
  // A selection made under other filters would act on rows no longer in view.
  useEffect(() => {
    setCurrentPage(1);
    setSelected(new Map());
  }, [filter, typeFilter, sourceFilter, searchTerm, itemsPerPage, sortOrder]);

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

  const getReportTypeIcon = (reportType: string) => {
    const icons = {
      job: <ImageIcon className="h-4 w-4" />,
      user: <Users className="h-4 w-4" />,
      message: <MessageSquare className="h-4 w-4" />,
      conversation: <MessageSquare className="h-4 w-4" />,
      review: <Star className="h-4 w-4" />,
      payment: <CreditCard className="h-4 w-4" />,
    };
    return icons[reportType as keyof typeof icons] || <Flag className="h-4 w-4" />;
  };

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 pb-2 md:px-6 md:py-5">
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Flagged Content
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">Review and resolve user complaints and reported content</p>
            </div>
            

          </div>

          {/* Mobile Header */}
          <div className="md:hidden">
            {/* Summary strip */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Reports</p>
                <p className="text-base font-black text-blue-600 leading-tight">{statusCounts.all.toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => selectStatCard(STAT_CARDS[0])}
                className={`flex-1 text-left rounded-xl px-3 py-2 border ${isStatCardActive(STAT_CARDS[0]) ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-100'}`}
              >
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Needs Review</p>
                <p className="text-base font-black text-amber-600 leading-tight">{statusCounts.needs_review.toLocaleString()}</p>
              </button>
            </div>
            {/* Filter pills — the same five slices as the desktop counter row. */}
            <div className="flex gap-2">
              {([
                { card: STAT_CARDS[1], label: 'All',       activeBg: 'bg-blue-500',    border: 'border-blue-500'    },
                { card: STAT_CARDS[2], label: 'Jobs',      activeBg: 'bg-orange-500',  border: 'border-orange-500'  },
                { card: STAT_CARDS[3], label: 'Users',     activeBg: 'bg-purple-500',  border: 'border-purple-500'  },
                { card: STAT_CARDS[4], label: 'Resolved',  activeBg: 'bg-emerald-500', border: 'border-emerald-500' },
                { card: STAT_CARDS[5], label: 'Dismissed', activeBg: 'bg-indigo-500',  border: 'border-indigo-500'  },
              ]).map(({ card, label, activeBg, border }) => {
                const active = isStatCardActive(card);
                return (
                  <button
                    key={card.key}
                    onClick={() => selectStatCard(card)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full border transition-all active:scale-95 ${active ? `${activeBg} ${border} text-white` : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    <span className="text-[11px] font-black">{statusCounts[card.statKey].toLocaleString()}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'text-white/80' : 'text-gray-400'}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Counter row — the five slices, always on one line. Statuses that
              aren't headline numbers (Open, Under Review, Escalated) stay
              reachable through the status dropdown in the filter bar. */}
          <div className="hidden md:grid md:grid-cols-5 gap-2 lg:gap-4">
            {STAT_CARDS.filter((card) => card.key !== 'all').map((card) => (
              <div key={card.key} className="cursor-pointer min-w-0" onClick={() => selectStatCard(card)}>
                <StatsCard
                  title={card.title}
                  value={statusCounts[card.statKey].toLocaleString()}
                  icon={card.icon}
                  color={card.color}
                  variant="tinted"
                  isActive={isStatCardActive(card)}
                  smallIcon={true}
                  showActiveIcon={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 md:px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center gap-3 md:gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 md:h-4 md:w-4" />
            <input
              type="text"
              placeholder="Search by keywords, reporter, or reported user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 h-8 md:h-auto md:py-2 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs md:text-sm font-medium transition-all shadow-sm"
            />
          </div>

          {/* Mobile filter dropdowns grid */}
          <div className="grid grid-cols-3 gap-2 md:hidden w-full">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ReportFilterStatus)}
              className="h-8 rounded-lg text-[11px] font-black w-full px-2 py-1.5 bg-white border border-gray-200 shadow-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="needs_review">Needs Review</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="action_taken">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="escalated">Escalated to Dispute</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="h-8 rounded-lg text-[11px] font-black w-full px-2 py-1.5 bg-white border border-gray-200 shadow-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All Sources ({stats.total})</option>
              <option value="report">Reports ({stats.report})</option>
              <option value="reported_post">Reported Posts ({stats.reported_post})</option>
            </select>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="h-8 rounded-lg text-[11px] font-black w-full px-2 py-1.5 bg-white border border-gray-200 shadow-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          {/* Status — Open, Under Review and Escalated have no counter card, and
              this picker existed only in the mobile layout, so on desktop the
              reports still awaiting a decision could not be isolated at all. */}
          <div className="hidden md:flex items-center gap-2 md:order-1 shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Status</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ReportFilterStatus)}
              className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All ({statusCounts.all})</option>
              <option value="needs_review">Needs Review ({statusCounts.needs_review})</option>
              <option value="open">Open ({statusCounts.open})</option>
              <option value="under_review">Under Review ({statusCounts.under_review})</option>
              <option value="action_taken">Resolved ({statusCounts.action_taken})</option>
              <option value="dismissed">Dismissed ({statusCounts.dismissed})</option>
              <option value="escalated">Escalated to Dispute ({statusCounts.escalated})</option>
            </select>
          </div>

          {/* Source picker — `reports` and `reportedposts` are separate
              collections merged into this one table. */}
          <div className="hidden md:flex items-center gap-2 md:order-2 shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Source</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All ({stats.total})</option>
              <option value="report">Reports ({stats.report})</option>
              <option value="reported_post">Reported Posts ({stats.reported_post})</option>
            </select>
          </div>

          <div className="flex items-center gap-2 md:order-3 shrink-0 w-full md:w-auto">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Sort</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="flex-1 md:flex-none bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              data-testid="flagged-sort"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div className="hidden md:flex items-center gap-2 md:order-4 shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : paginatedReports.length === 0 ? (
            <div className="bg-white p-20 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gray-50 mb-6">
                <Flag className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-900 font-black text-xl mb-2">Clean slate!</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">No reports match your current filters. Everything looks good.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-12 pl-6 pr-2 py-4 border-b border-gray-200">
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
                      <th className="w-[12%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Type</th>
                      <th className="w-[12%] px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Source</th>
                      <th className="w-[16%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported User</th>
                      <th className="w-[14%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported By</th>
                      <th className="w-[17%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reason & Comment</th>
                      <th className="w-[10%] px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported</th>
                      <th className="w-[13%] px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {paginatedReports.map((report) => (
                      <tr
                        key={report._id}
                        ref={highlightedPostId === report._id ? highlightedRowRef : null}
                        onClick={() => handleViewReport(report)}
                        data-testid="flagged-row"
                        className={`group h-20 transition-all duration-150 cursor-pointer ${highlightedPostId === report._id ? 'bg-amber-50 ring-inset ring-2 ring-amber-400' : selected.has(selectionKey(report)) ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                      >
                        <td className="pl-6 pr-2 py-2 align-middle border-b border-gray-300" onClick={(e) => e.stopPropagation()}>
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
                        {/* Type */}
                        <td className="px-4 py-2 align-middle border-b border-gray-300">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-lg group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                              {React.cloneElement(getReportTypeIcon(report.reportType) as React.ReactElement, { className: 'h-4 w-4 text-gray-400 group-hover:text-blue-500' })}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 group-hover:text-blue-700 transition-colors capitalize truncate">{report.reportType || 'other'}</p>
                              {report.job?.title && (
                                <p className="text-[11px] text-gray-400 truncate" title={report.job.title}>{report.job.title}</p>
                              )}
                              {(report.job?.isDeleted || report.job?.isHidden) && (
                                <Signal icon={report.job.isDeleted ? Trash2 : EyeOff} tone="red" title={report.job.isDeleted ? 'The post has been deleted' : 'The post is hidden from the app'}>
                                  {report.job.isDeleted ? 'Post deleted' : 'Post hidden'}
                                </Signal>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Source */}
                        <td className="px-3 py-2 align-middle border-b border-gray-300">
                          <span
                            title={SOURCE_BADGES[report.source].label}
                            className={`inline-block max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border align-middle ${SOURCE_BADGES[report.source].className}`}
                          >
                            {SOURCE_BADGES[report.source].label}
                          </span>
                        </td>

                        {/* Reported user */}
                        <td className="px-4 py-2 align-middle border-b border-gray-300">
                          {(() => {
                            const party = report.reportedUserId;
                            const signals = reportedSignals(report);
                            return (
                              <div className="flex items-center gap-2.5 min-w-0" title={contactOf(party) || undefined}>
                                <PartyAvatar name={party?.name} tone="reported" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">{party?.name || 'N/A'}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{contactOf(party) || 'No contact'}</p>
                                  {signals.length > 0 && (
                                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5" data-testid="flagged-reported-chips">{signals}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Reported by */}
                        <td className="px-4 py-2 align-middle border-b border-gray-300">
                          {(() => {
                            const party = report.reportedBy;
                            const signals = reporterSignals(report);
                            return (
                              <div className="flex items-center gap-2.5 min-w-0" title={contactOf(party) || undefined}>
                                <PartyAvatar name={party?.name} tone="reporter" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">{party?.name || 'Unknown'}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{contactOf(party) || 'No contact'}</p>
                                  {signals.length > 0 && (
                                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5" data-testid="flagged-reporter-chips">{signals}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Reason & comment */}
                        <td className="px-4 py-2 align-middle border-b border-gray-300">
                          <p className="text-xs font-bold text-red-600 truncate">{humanize(report.reason) || 'Other'}</p>
                          {report.comment ? (
                            <p className="text-[11px] text-gray-500 leading-snug line-clamp-2 mt-0.5" title={report.comment}>{report.comment}</p>
                          ) : (
                            <p className="text-[11px] text-gray-400 italic mt-0.5">No comment</p>
                          )}
                        </td>

                        {/* Reported */}
                        <td className="px-3 py-2 align-middle border-b border-gray-300">
                          {(() => {
                            const age = ageLine(report);
                            const open = isAwaitingDecision(report);
                            return (
                              <>
                                <p
                                  className={`text-xs font-bold whitespace-nowrap ${open && age ? AGE_TONE[age.tone] : 'text-gray-900'}`}
                                  title={open && age ? age.text : new Date(report.createdAt).toLocaleString()}
                                  data-testid="flagged-age-time"
                                >
                                  {formatDistanceToNowStrict(new Date(report.createdAt), { addSuffix: true })}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap" data-testid="flagged-date">{new Date(report.createdAt).toLocaleDateString()}</p>
                                {age && open && age.tone === 'urgent' && (
                                  <span className="block mt-0.5" data-testid="flagged-age">
                                    <Signal icon={AlertCircle} tone="red" title={age.text}>Overdue</Signal>
                                  </span>
                                )}
                                {age && !open && (
                                  <p className="text-[10px] text-gray-400 mt-0.5" data-testid="flagged-age">{age.text}</p>
                                )}
                              </>
                            );
                          })()}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2 align-middle text-center border-b border-gray-300">
                          <div className="flex flex-col items-center gap-1 min-w-0">
                            <StatusPill status={report.status} testId="flagged-status" />
                            {tableOutcome(report) && (
                              <p className="max-w-full text-[11px] font-semibold text-gray-700 truncate" title={tableOutcome(report) || undefined} data-testid="flagged-outcome">{tableOutcome(report)}</p>
                            )}
                            {report.reviewedBy?.name && !isAwaitingDecision(report) && (
                              <p className="max-w-full text-[10px] text-gray-400 truncate" title={report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : undefined}>
                                by {report.reviewedBy.name}{report.reviewedAt ? ` · ${formatDistanceToNowStrict(new Date(report.reviewedAt), { addSuffix: true })}` : ''}
                              </p>
                            )}
                            {isAwaitingDecision(report) && (
                              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5">
                                <Eye className="h-3 w-3" /> Review <ChevronRight className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden px-3 py-3 space-y-2">
                {paginatedReports.map((report) => (
                  <div
                    key={report._id}
                    onClick={() => handleViewReport(report)}
                    data-testid="flagged-card"
                    className={`bg-white rounded-xl border shadow-sm overflow-hidden active:scale-[0.98] transition-all ${selected.has(selectionKey(report)) ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between px-3 py-2 gap-1.5 bg-gray-50/80 border-b border-gray-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isAwaitingDecision(report) && (
                          <input
                            type="checkbox"
                            aria-label="Select report"
                            checked={selected.has(selectionKey(report))}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(report)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                          />
                        )}
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-gray-200 text-gray-700 shrink-0">{report.reportType || 'other'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${SOURCE_BADGES[report.source].className}`}>{SOURCE_BADGES[report.source].label}</span>
                        <StatusPill status={report.status} className="shrink-0 !text-[9px] !px-2" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0">
                        {formatDistanceToNowStrict(new Date(report.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="px-3 py-2.5">
                       <h3 className="text-sm font-bold text-red-600 mb-2">{humanize(report.reason) || 'Other'}</h3>

                       {report.job?.title && (
                         <div className="px-2.5 py-2 mb-2 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Reported Job</p>
                            <p className="text-xs font-black text-gray-900 truncate">{report.job.title}</p>
                         </div>
                       )}

                       <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="px-2.5 py-2 bg-gray-50 rounded-xl border border-gray-100 min-w-0">
                             <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Reported User</p>
                             <div className="flex items-center gap-2 min-w-0">
                               <PartyAvatar name={report.reportedUserId?.name} tone="reported" />
                               <p className="text-xs font-black text-gray-900 truncate">{report.reportedUserId?.name || 'N/A'}</p>
                             </div>
                             {reportedSignals(report).length > 0 && <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5">{reportedSignals(report)}</div>}
                          </div>
                          <div className="px-2.5 py-2 bg-gray-50 rounded-xl border border-gray-100 min-w-0">
                             <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Reported By</p>
                             <div className="flex items-center gap-2 min-w-0">
                               <PartyAvatar name={report.reportedBy?.name} tone="reporter" />
                               <p className="text-xs font-black text-gray-900 truncate">{report.reportedBy?.name || 'Unknown'}</p>
                             </div>
                             {reporterSignals(report).length > 0 && <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5">{reporterSignals(report)}</div>}
                          </div>
                       </div>

                       <div className="px-2.5 py-2 bg-blue-50/30 rounded-xl border border-blue-100/50">
                          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-0.5">Reporter's comment</p>
                          <p className="text-xs text-gray-700 leading-relaxed italic">"{report.comment || 'No additional details provided by reporter.'}"</p>
                       </div>
                    </div>

                    <div className="px-3 py-2.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                       <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                         <Calendar className="h-3 w-3" />
                         {new Date(report.createdAt).toLocaleDateString()}
                         {(() => {
                           const age = ageLine(report);
                           if (!age) return null;
                           return isAwaitingDecision(report)
                             ? <span className={AGE_TONE[age.tone]}>· {age.tone === 'urgent' ? 'Overdue' : age.text}</span>
                             : <span>· {age.text}</span>;
                         })()}
                       </div>
                       <div className="text-blue-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1">
                          REVIEW REPORT <ChevronRight className="h-3 w-3" />
                       </div>
                    </div>
                  </div>
                ))}
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

        {/* Pagination — outside scroll, always sticky at bottom */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 z-10 px-4 h-[65px] flex items-center">
            <div className="flex items-center justify-between w-full">
              <p className="text-xs md:text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredReports.length)}</span> of{' '}
                <span className="font-medium">{filteredReports.length}</span> results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
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
