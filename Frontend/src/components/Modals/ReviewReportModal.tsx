import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  Video,
  Ban,
  Shield,
  ShieldAlert,
  Clock,
  AlertCircle,
  Flag,
  User as UserIcon,
  UserX,
  Users,
  Briefcase,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  EyeOff,
  Gavel,
  Repeat,
  Info,
  Quote,
  Files,
  FileText,
  Copy,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import SideModal from '../SideModal';
import type { CombinedReport, ReportParty } from '../../services/flaggedService';
import { formatBudgetWithType } from '../../utils/currency';
import { useUserDetails, useUserPenalties, useUserStanding } from '../../hooks/useUsers';
import {
  ROLE_LABELS,
  ageLine,
  buildReportIndex,
  humanize,
  isAwaiting,
  isMutual,
  meaningfulNotes,
  outcomeOf,
  partyContact,
  tableOutcome,
  trackRecord,
} from '../Flagged/reportInsights';
import { ACCOUNT_SIGNAL, PartyAvatar, Signal, StatusPill } from '../Flagged/ReportUI';

export type ReportDecision = 'approve' | 'dismiss' | 'delete' | 'resolve';
type AccountAction = 'restrict' | 'suspend' | 'ban' | 'delete';

interface ReviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: CombinedReport | null;
  /** Every loaded report — for the repeat counts, the reporter's record and related reports. */
  allReports: CombinedReport[];
  /** Switch the panel to another report (from "Other reports"). */
  onOpenReport: (report: CombinedReport) => void;
  /** Decide the report; `notes` is what the admin typed in Admin notes. */
  onReview: (action: ReportDecision, notes: string) => Promise<void>;
  isLoading: boolean;
  onUserAction?: (userId: string, actionType: AccountAction, duration?: number, reason?: string, notes?: string) => Promise<void>;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  job: { label: 'Job post', icon: Briefcase },
  user: { label: 'User', icon: UserIcon },
  message: { label: 'Message', icon: MessageSquare },
  conversation: { label: 'Chat', icon: MessageSquare },
  review: { label: 'Review', icon: Flag },
  payment: { label: 'Payment', icon: Flag },
  other: { label: 'Other', icon: Flag },
};

/** What the report points at, when the content itself isn't stored on the report. */
const UNSTORED_CONTENT: Record<string, string> = {
  message: 'The reported message is not stored with the report — only its reference below. Weigh the reporter’s comment and the people involved.',
  conversation: 'The reported chat is not stored with the report — only its reference below. Weigh the reporter’s comment and the people involved.',
  review: 'The reported review is not stored with the report — only its reference below.',
  payment: 'The payment is not stored with the report — only its reference below. Check Transactions for the money trail.',
  other: 'This report has no attached content — only the reporter’s reason and comment.',
};

const SOURCE_LABEL: Record<string, string> = { report: 'Reports', reported_post: 'Reported Posts' };

/** Same pills as the Users page. */
const ROLE_PILL: Record<string, string> = {
  provider: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  client: 'bg-purple-50 text-purple-700 border-purple-100',
};
const ACCOUNT_PILL: Record<string, string> = {
  restricted: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  banned: 'bg-red-50 text-red-700 border-red-200',
  deleted: 'bg-gray-100 text-gray-600 border-gray-200',
};

const AGE_PILL = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  muted: 'bg-gray-50 text-gray-500 border-gray-200',
} as const;

const formatStamp = (value?: string | Date | null) => (value ? format(new Date(value), 'MMM d, yyyy · h:mm a') : '—');
const formatDay = (value?: string | Date | null) => (value ? format(new Date(value), 'MMM d, yyyy') : '—');
const ago = (value?: string | Date | null) => (value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : '');

const copy = (value: string, label: string) =>
  navigator.clipboard.writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error(`Failed to copy ${label.toLowerCase()}`));

const Pill: React.FC<{ className: string; title?: string; children: React.ReactNode }> = ({ className, title, children }) => (
  <span title={title} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${className}`}>
    {children}
  </span>
);

/**
 * One collapsible section: a row with a title and a one-line summary, so the
 * panel reads at a glance and the detail is one click away.
 */
const Disclosure: React.FC<{ id: string; title: string; icon: React.ElementType; summary?: React.ReactNode; open: boolean; onToggle: () => void; testId?: string; children: React.ReactNode }> = ({ id, title, icon: Icon, summary, open, onToggle, testId, children }) => (
  <section className="rounded-xl border border-gray-100 bg-white" data-testid={testId}>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`report-section-${id}`}
      data-testid={testId ? `${testId}-toggle` : undefined}
      className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-gray-50/80 transition-colors"
    >
      <Icon className="h-4 w-4 text-gray-400 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        {summary && <span className="block text-xs text-gray-500 truncate mt-0.5">{summary}</span>}
      </span>
      <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id={`report-section-${id}`} className="px-4 pb-4 pt-3 border-t border-gray-100">{children}</div>}
  </section>
);

/** Long text clamped to a few lines with a "Show more" toggle. */
const ExpandableText: React.FC<{ text: string; lines?: 3 | 4; className?: string }> = ({ text, lines = 4, className = 'text-gray-800' }) => {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > (lines === 3 ? 180 : 240) || text.split('\n').length > lines;
  return (
    <div className="min-w-0">
      <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${className} ${long && !expanded ? (lines === 3 ? 'line-clamp-3' : 'line-clamp-4') : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-semibold text-blue-600 hover:underline">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

/** A fact in a grid: small label above, value below. */
const Fact: React.FC<{ label: string; value: React.ReactNode; tone?: string; wide?: boolean }> = ({ label, value, tone, wide }) => (
  <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className={`text-sm font-semibold mt-0.5 truncate ${tone || 'text-gray-900'}`}>{value}</dd>
  </div>
);

/** A highlighted line inside a card (restriction, mutual reports, hidden post). */
const Banner: React.FC<{ icon: React.ElementType; className: string; iconClass: string; children: React.ReactNode }> = ({ icon: Icon, className, iconClass, children }) => (
  <div className={`flex items-start gap-2 p-3 border rounded-lg text-xs ${className}`}>
    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconClass}`} />
    <div className="min-w-0">{children}</div>
  </div>
);

const PartyHeader: React.FC<{ party: ReportParty; tone: 'reported' | 'reporter' }> = ({ party, tone }) => {
  const status = party.accountStatus;
  return (
    <div className="flex items-center gap-3">
      <PartyAvatar name={party.name} tone={tone} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-gray-900 truncate">{party.name || 'Unknown'}</p>
        <p className="text-xs text-gray-500 truncate">
          {partyContact(party) || 'No contact on file'}
          <span className="text-gray-300"> · </span>
          <span className="font-mono text-gray-400">#{party._id.slice(-6).toUpperCase()}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {party.userType && (
          <Pill className={ROLE_PILL[party.userType] || 'bg-gray-50 text-gray-600 border-gray-200'}>
            {party.userType === 'provider' ? <Briefcase className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
            {ROLE_LABELS[party.userType] || party.userType}
          </Pill>
        )}
        {status && status !== 'active' && <Pill className={ACCOUNT_PILL[status] || 'bg-gray-50 text-gray-600 border-gray-200'}>{status}</Pill>}
      </div>
    </div>
  );
};

const RelatedRow: React.FC<{ report: CombinedReport; label: string; onOpen: () => void }> = ({ report, label, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    data-testid="report-related-row"
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 text-left transition-colors"
  >
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-gray-900 truncate">
        {humanize(report.reason)} <span className="font-medium text-gray-400">· {label}</span>
      </p>
      <p className="text-[11px] text-gray-400 truncate">
        {ago(report.createdAt)}
        {tableOutcome(report) ? ` · ${tableOutcome(report)}` : ''}
      </p>
    </div>
    <StatusPill status={report.status} className="shrink-0" />
    <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
  </button>
);

const CopyId: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <button type="button" onClick={() => copy(value, label)} title={`Copy ${label.toLowerCase()}`} className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-blue-600 max-w-full">
    <span className="truncate">{value}</span>
    <Copy className="w-3 h-3 text-gray-300 shrink-0" />
  </button>
);

const RELATED_SHOWN = 5;

const ReviewReportModal: React.FC<ReviewReportModalProps> = ({
  isOpen,
  onClose,
  report,
  allReports,
  onOpenReport,
  onReview,
  isLoading,
  onUserAction,
}) => {
  const [adminNotes, setAdminNotes] = useState('');
  const [confirmingAction, setConfirmingAction] = useState<AccountAction | null>(null);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [actionReason, setActionReason] = useState<string>('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const resetAction = () => {
    setConfirmingAction(null);
    setDurationDays(0);
    setDurationHours(0);
    setDurationMinutes(0);
    setActionReason('');
  };

  // A new report (or reopening) starts from a clean slate.
  useEffect(() => {
    setAdminNotes('');
    resetAction();
    setOpen({ content: report?.reportType === 'job' });
  }, [report?._id, isOpen]);

  const reported = report?.reportedUserId || null;
  const reporter = report?.reportedBy || null;
  const awaiting = report ? isAwaiting(report) : false;

  const details = useUserDetails(reported?._id, isOpen && !!reported);
  const standing = useUserStanding(reported?._id, isOpen && !!reported);
  const penalties = useUserPenalties(reported?._id, isOpen && !!reported);

  const index = useMemo(() => buildReportIndex(allReports), [allReports]);

  if (!report) return null;

  const type = TYPE_META[report.reportType] || TYPE_META.other;
  const isJobReport = report.reportType === 'job';
  const job = report.job;
  const age = ageLine(report);
  const outcome = outcomeOf(report);
  const notes = meaningfulNotes(report);
  const mutual = isMutual(report, index);
  const record = trackRecord(reporter ? (index.filedBy.get(reporter._id) || []).filter((r) => r._id !== report._id) : []);

  // Other reports naming the same person, and other reports about the same job.
  const aboutPerson = reported ? (index.against.get(reported._id) || []).filter((r) => r._id !== report._id) : [];
  const personIds = new Set(aboutPerson.map((r) => r._id));
  const aboutJob = isJobReport && job?._id
    ? (index.aboutJob.get(job._id) || []).filter((r) => r._id !== report._id && !personIds.has(r._id))
    : [];
  const byNewest = (a: CombinedReport, b: CombinedReport) => +new Date(b.createdAt) - +new Date(a.createdAt);
  aboutPerson.sort(byNewest);
  aboutJob.sort(byNewest);

  const user = details.data;
  const restriction = user?.restrictionDetails;
  const restrictionEnds = restriction?.suspendedUntil || restriction?.expiresAt;
  // A far-future sentinel marks an indefinite admin suspension.
  const indefinite = restrictionEnds ? new Date(restrictionEnds).getFullYear() > 2100 : false;
  const loadingStanding = standing.isLoading;
  const againstTotal = standing.data?.reportsAgainst.total || 0;
  const penaltyTotal = penalties.data?.totalPenalties || 0;

  // The few facts worth seeing before opening anything.
  const accountStatus = user?.accountStatus || reported?.accountStatus;
  const accountSignal = accountStatus && accountStatus !== 'active' ? ACCOUNT_SIGNAL[accountStatus] : null;
  const untilText = accountSignal && restrictionEnds && !indefinite ? ` until ${format(new Date(restrictionEnds), 'MMM d')}` : '';
  const reportCount = standing.data ? againstTotal : aboutPerson.length + (reported ? 1 : 0);
  const mostlyDismissed = record.total >= 3 && record.dismissed / Math.max(1, record.dismissed + record.actioned) >= 0.75;
  const signals = [
    accountSignal && <Signal key="account" icon={accountSignal.icon} tone={accountSignal.tone} title="The reported account's status right now">{accountSignal.label}{untilText}</Signal>,
    reportCount >= 2 && <Signal key="reports" icon={Flag} tone={reportCount >= 3 ? 'red' : 'amber'} title="Reports naming this person">Reported {reportCount}×</Signal>,
    penaltyTotal > 0 && <Signal key="penalties" icon={Gavel} tone="orange" title="Earlier restrictions, suspensions and bans">{penaltyTotal} past {penaltyTotal === 1 ? 'penalty' : 'penalties'}</Signal>,
    mutual && <Signal key="mutual" icon={Repeat} tone="violet" title="Each has reported the other">Reported each other</Signal>,
    mostlyDismissed && <Signal key="reporter" icon={AlertCircle} tone="amber" title="Most of this reporter's decided reports were dismissed">Reporter often dismissed</Signal>,
    isJobReport && job && (job.isDeleted || job.isHidden) && <Signal key="post" icon={job.isDeleted ? Trash2 : EyeOff} tone="red">{job.isDeleted ? 'Post deleted' : 'Post hidden'}</Signal>,
  ].filter(Boolean);

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const reportedSummary = reported
    ? [reported.name, ROLE_LABELS[reported.userType] || reported.userType,
      accountSignal ? `${accountSignal.label}${untilText}` : null,
      standing.data ? count(againstTotal, 'report against them', 'reports against them') : null,
      penaltyTotal ? count(penaltyTotal, 'past penalty', 'past penalties') : null].filter(Boolean).join(' · ')
    : 'No account attached';
  const reporterSummary = reporter
    ? [reporter.name, ROLE_LABELS[reporter.userType] || reporter.userType,
      record.total ? `${count(record.total, 'other report', 'other reports')} filed${record.dismissed ? `, ${record.dismissed} dismissed` : ''}` : 'First report they filed'].filter(Boolean).join(' · ')
    : 'Reporter not found';
  const stillOpen = [...aboutPerson, ...aboutJob].filter(isAwaiting).length;
  const relatedSummary = [aboutPerson.length ? `${aboutPerson.length} about ${reported?.name?.split(' ')[0] || 'this person'}` : null,
    aboutJob.length ? `${aboutJob.length} about this post` : null, stillOpen ? `${stillOpen} still open` : null].filter(Boolean).join(' · ');

  const handleConfirmAction = async () => {
    if (!confirmingAction || !reported?._id || !onUserAction) return;
    const totalDays = durationDays + durationHours / 24 + durationMinutes / (24 * 60);
    if (confirmingAction !== 'delete' && totalDays <= 0) {
      toast.error('Please enter a duration');
      return;
    }
    if (!actionReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    // The parent applies the action and records the report as actioned with it.
    // It throws when the action fails, which keeps both the report and what the
    // admin typed here.
    try {
      await onUserAction(reported._id, confirmingAction, confirmingAction === 'delete' ? undefined : totalDays, actionReason, adminNotes.trim());
    } catch {
      return;
    }
    resetAction();
  };

  const actionLabel = confirmingAction ? confirmingAction.charAt(0).toUpperCase() + confirmingAction.slice(1) : '';

  return (
    <SideModal isOpen={isOpen} onClose={onClose} title={`Review ${type.label.toLowerCase()} report`} width="2xl">
      <div className="flex-1 min-h-0 flex flex-col" data-testid="report-modal">
        {/* SideModal's content area doesn't scroll, so this does; the action bar sits below it. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" data-testid="report-scroll">
          {/* At a glance: everything needed to decide, nothing more. */}
          <section className="px-4 md:px-6 pt-5 pb-4 space-y-3" data-testid="report-summary">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={report.status} />
              {age && (
                <Pill className={AGE_PILL[age.tone]}>
                  <Clock className="h-3 w-3" />
                  {age.text}
                </Pill>
              )}
              <span className="ml-auto text-xs text-gray-400 whitespace-nowrap" title={formatStamp(report.createdAt)}>Reported {formatDay(report.createdAt)}</span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 leading-tight">{humanize(report.reason) || 'No reason given'}</h2>

            <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <Quote className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
              {report.comment ? (
                <ExpandableText text={report.comment} />
              ) : (
                <p className="text-sm text-gray-400 italic">The reporter didn’t add a comment.</p>
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0 text-xs">
              <span className="sr-only">Filed by {reporter?.name || 'an unknown user'} against {reported?.name || job?.title || 'an unknown user'}</span>
              <PartyAvatar name={reporter?.name} tone="reporter" />
              <span className="font-semibold text-gray-800 truncate" aria-hidden>{reporter?.name || 'Unknown'}</span>
              <span className="text-gray-400 shrink-0" aria-hidden>reported</span>
              <PartyAvatar name={reported?.name || job?.title} tone="reported" />
              <span className="font-semibold text-gray-800 truncate" aria-hidden>{reported?.name || job?.title || 'Unknown'}</span>
            </div>

            {!isJobReport && report.reportType !== 'user' && (
              <p className="flex items-start gap-1.5 text-xs text-gray-500" data-testid="report-content">
                <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                {UNSTORED_CONTENT[report.reportType] || UNSTORED_CONTENT.other}
              </p>
            )}

            {signals.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1" data-testid="report-signals">{signals}</div>
            )}
          </section>

          <div className="px-4 md:px-6 pb-5 space-y-2">
            {/* Decision, once made */}
            {!awaiting && (
              <section
                className={`rounded-xl border p-4 mb-2 ${report.status === 'dismissed' ? 'border-gray-200 bg-gray-50' : 'border-emerald-100 bg-emerald-50/50'}`}
                data-testid="report-decision"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Gavel className={`h-4 w-4 ${report.status === 'dismissed' ? 'text-gray-500' : 'text-emerald-700'}`} />
                  {outcome || humanize(report.status)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {report.reviewedBy?.name ? <>by <span className="font-semibold">{report.reviewedBy.name}</span></> : 'Reviewer not recorded'}
                  {report.reviewedAt ? ` · ${formatStamp(report.reviewedAt)}` : ''}
                  {age?.tone === 'muted' ? ` · ${age.text.toLowerCase()}` : ''}
                </p>
                {notes ? (
                  <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words" data-testid="report-decision-notes">{notes}</p>
                ) : (
                  <p className="mt-2 text-xs text-gray-400 italic">No note was left with this decision.</p>
                )}
              </section>
            )}

            {/* The reported post: the evidence, open by default */}
            {isJobReport && (
              <Disclosure
                id="content"
                title="Reported post"
                icon={Briefcase}
                summary={job ? [job.title || 'Untitled', job.category, `${job.media?.length || 0} ${(job.media?.length || 0) === 1 ? 'photo' : 'photos'}`].filter(Boolean).join(' · ') : 'Post not found'}
                open={!!open.content}
                onToggle={() => toggle('content')}
                testId="report-content"
              >
                {job ? (
                  <div className="space-y-3">
                    {(job.isDeleted || job.isHidden) && (
                      <Banner icon={AlertTriangle} className="bg-red-50 border-red-100 text-red-800" iconClass="text-red-500">
                        <p className="font-semibold">
                          {job.isDeleted ? 'This post has been deleted — shown from the copy saved with the report.' : 'This post is hidden from the app.'}
                        </p>
                      </Banner>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">{job.title || 'Untitled'}</p>
                      {job.description ? <ExpandableText text={job.description} className="text-gray-600 mt-0.5" lines={3} /> : <p className="text-sm text-gray-400">No description</p>}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      <Fact label="Category" value={job.category || '—'} />
                      <Fact label="Budget" value={job.budget ? formatBudgetWithType(job.budget, job.budgetType || 'fixed') : 'Not set'} tone={job.budget ? undefined : 'text-gray-400'} />
                      <Fact label="Location" value={[job.location?.address, job.location?.city].filter(Boolean).join(', ') || '—'} />
                      <Fact label="Posted" value={job.createdAt ? `${formatDay(job.createdAt)} · ${humanize(job.status) || '—'}` : '—'} />
                    </dl>
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1.5">Media {job.media?.length ? `(${job.media.length})` : ''}</p>
                      {job.media && job.media.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                          {job.media.map((item, i) => {
                            const url = typeof item === 'string' ? item : (item as any)?.url || (item as any)?.type;
                            const isVideo = typeof item === 'string' ? /\.(mp4|webm|mov|avi)$/i.test(url || '') : (item as any)?.mediaType === 'video';
                            return (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={isVideo ? 'Open video' : 'Open image'}
                                className="relative block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-90">
                                {isVideo ? <video src={url} className="w-full h-full object-cover" preload="metadata" muted /> : <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />}
                                {isVideo && <Video className="absolute top-1 left-1 h-3.5 w-3.5 text-white drop-shadow" />}
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No media on this post</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">The post could not be found, and no copy was saved with the report.</p>
                )}
              </Disclosure>
            )}

            {/* Reported user */}
            <Disclosure
              id="reported"
              title={isJobReport ? 'Posted by (reported)' : 'Reported user'}
              icon={UserX}
              summary={reportedSummary}
              open={!!open.reported}
              onToggle={() => toggle('reported')}
              testId="report-reported-user"
            >
              {reported ? (
                <div className="space-y-3">
                  <PartyHeader party={reported} tone="reported" />
                  {restriction && user?.accountStatus && user.accountStatus !== 'active' && (
                    <Banner icon={ShieldAlert} className="bg-amber-50 border-amber-200 text-amber-900" iconClass="text-amber-600">
                      <p className="font-bold">
                        Currently {user.accountStatus}
                        {restrictionEnds && !indefinite ? ` until ${formatStamp(restrictionEnds)}` : indefinite ? ' · no end date' : ''}
                      </p>
                      {restriction.reason && <p className="mt-0.5 text-amber-800">“{restriction.reason}”</p>}
                      <p className="mt-0.5 text-amber-700/80">Since {formatStamp(restriction.restrictedAt)}</p>
                    </Banner>
                  )}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <Fact
                      label="Reports against"
                      value={loadingStanding ? '…' : standing.data ? `${againstTotal}${standing.data.reportsAgainst.open ? ` (${standing.data.reportsAgainst.open} open)` : ''}` : '—'}
                      tone={againstTotal >= 3 ? 'text-red-600' : undefined}
                    />
                    <Fact
                      label="Past penalties"
                      value={penalties.isLoading ? '…' : penalties.data ? `${penaltyTotal}${penalties.data.lastPenalty ? ` · last ${ago(penalties.data.lastPenalty)}` : ''}` : '—'}
                      tone={penaltyTotal > 0 ? 'text-orange-600' : undefined}
                    />
                    <Fact label="Reports they filed" value={loadingStanding ? '…' : standing.data?.reportsFiled ?? '—'} />
                    <Fact label="Member since" value={details.isLoading ? '…' : user?.createdAt ? formatDay(user.createdAt) : '—'} />
                    <Fact label="Verified" value={details.isLoading ? '…' : user ? (user.isVerified ? 'Yes' : 'No') : '—'} tone={user && !user.isVerified ? 'text-gray-500' : undefined} />
                    <Fact label="Last seen" value={details.isLoading ? '…' : user?.lastLogin ? ago(user.lastLogin) : '—'} />
                    {reported.userType === 'provider' ? (
                      <Fact label="Rating · jobs done" value={details.isLoading ? '…' : user ? `${user.ratings ? user.ratings.toFixed(1) : '—'} · ${user.completedJobs ?? 0}` : '—'} />
                    ) : (
                      <Fact label="Support tickets" value={loadingStanding ? '…' : standing.data ? `${standing.data.support.total}${standing.data.support.open ? ` (${standing.data.support.open} open)` : ''}` : '—'} />
                    )}
                    {(user?.faultFindings?.length || 0) > 0 && <Fact label="Dispute fault findings" value={user!.faultFindings!.length} tone="text-orange-600" />}
                  </dl>
                  {details.isError && <p className="text-xs text-gray-400">Couldn’t load the full account — some details may be missing.</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No account is attached to this report{isJobReport ? ' — the poster could not be resolved.' : ' (it may have been deleted).'}</p>
              )}
            </Disclosure>

            {/* Reporter */}
            <Disclosure
              id="reporter"
              title="Reported by"
              icon={Users}
              summary={reporterSummary}
              open={!!open.reporter}
              onToggle={() => toggle('reporter')}
              testId="report-reporter"
            >
              {reporter ? (
                <div className="space-y-3">
                  <PartyHeader party={reporter} tone="reporter" />
                  <dl className="grid grid-cols-3 gap-x-4">
                    <Fact label="Other reports filed" value={record.total} />
                    <Fact label="Dismissed" value={record.dismissed} />
                    <Fact label="Led to action" value={record.actioned} tone={record.actioned > 0 ? 'text-emerald-700' : undefined} />
                  </dl>
                  {mostlyDismissed && <p className="text-xs text-amber-700">Most of this person’s decided reports were dismissed.</p>}
                  {mutual && <p className="text-xs text-violet-700">{reported?.name || 'The reported person'} has also reported {reporter.name}, so this may be one side of a dispute.</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-500">The reporter’s account could not be found.</p>
              )}
            </Disclosure>

            {/* Other reports */}
            {(aboutPerson.length > 0 || aboutJob.length > 0) && (
              <Disclosure
                id="related"
                title="Other reports"
                icon={Files}
                summary={relatedSummary}
                open={!!open.related}
                onToggle={() => toggle('related')}
                testId="report-related"
              >
                <div className="space-y-3">
                  {aboutPerson.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-gray-600">About {reported?.name || 'this person'} ({aboutPerson.length})</p>
                      {aboutPerson.slice(0, RELATED_SHOWN).map((r) => (
                        <RelatedRow key={r._id} report={r} label={`by ${r.reportedBy?.name || 'unknown'}`} onOpen={() => onOpenReport(r)} />
                      ))}
                      {aboutPerson.length > RELATED_SHOWN && <p className="text-[11px] text-gray-400">and {aboutPerson.length - RELATED_SHOWN} more</p>}
                    </div>
                  )}
                  {aboutJob.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-gray-600">About this post ({aboutJob.length})</p>
                      {aboutJob.slice(0, RELATED_SHOWN).map((r) => (
                        <RelatedRow key={r._id} report={r} label={`by ${r.reportedBy?.name || 'unknown'}`} onOpen={() => onOpenReport(r)} />
                      ))}
                      {aboutJob.length > RELATED_SHOWN && <p className="text-[11px] text-gray-400">and {aboutJob.length - RELATED_SHOWN} more</p>}
                    </div>
                  )}
                </div>
              </Disclosure>
            )}

            {/* Record */}
            <Disclosure
              id="record"
              title="Report details"
              icon={FileText}
              summary={[`#${report._id.slice(-6).toUpperCase()}`, SOURCE_LABEL[report.source] || report.source, report.reportMetadata?.reportSource ? `via ${humanize(report.reportMetadata.reportSource)}` : null].filter(Boolean).join(' · ')}
              open={!!open.record}
              onToggle={() => toggle('record')}
              testId="report-record"
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <Fact label="Report ID" value={<CopyId value={report._id} label="Report ID" />} wide />
                <Fact label="Stored in" value={SOURCE_LABEL[report.source] || report.source} />
                <Fact label="Submitted via" value={humanize(report.reportMetadata?.reportSource) || '—'} />
                <Fact label="Reported at" value={formatStamp(report.createdAt)} wide />
                {report.relatedId && !isJobReport && <Fact label="Reference" value={<CopyId value={report.relatedId} label="Reference" />} wide />}
                {report.rawStatus && report.rawStatus !== report.status && <Fact label="Stored status" value={report.rawStatus} tone="text-gray-500" />}
                {report.rawReason && report.rawReason !== report.reason && <Fact label="Stored reason" value={report.rawReason} tone="text-gray-500" />}
              </dl>
            </Disclosure>

            {/* Note, sent with whichever decision is made below. */}
            {awaiting && (
              <div className="pt-3">
                <label htmlFor="report-admin-notes" className="text-xs font-semibold text-gray-600">
                  Note for the record <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="report-admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  data-testid="report-admin-notes"
                  maxLength={1000}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Why you decided this — saved on the report"
                />
                {notes && <p className="mt-1 text-xs text-gray-500">Earlier note: “{notes}”</p>}
              </div>
            )}
          </div>
        </div>

        {/* Actions, below the scroll area while the report awaits a decision. */}
        {awaiting && !isLoading && (
          <div className="flex-shrink-0 max-h-[70%] overflow-y-auto border-t border-gray-200 px-4 md:px-6 py-4 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.06)]" data-testid="report-actions">
            {isJobReport ? (
              <div className="flex gap-3">
                <button
                  onClick={() => onReview('dismiss', adminNotes.trim())}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </button>
                <button
                  onClick={() => onReview('approve', adminNotes.trim())}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Keep Post
                </button>
                <button
                  onClick={() => onReview('delete', adminNotes.trim())}
                  disabled={isLoading || job?.isDeleted}
                  title={job?.isDeleted ? 'Already deleted — dismiss or keep instead' : undefined}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onReview('dismiss', adminNotes.trim())}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Dismiss Report
                  </button>
                  {!reported?._id && (
                    <button
                      onClick={() => onReview('resolve', adminNotes.trim())}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Resolved
                    </button>
                  )}
                </div>

                {reported?._id && onUserAction && (
                  confirmingAction ? (
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      {confirmingAction !== 'delete' ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Duration for {actionLabel}</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {([
                              ['Days', durationDays, (v: number) => setDurationDays(Math.max(0, v))],
                              ['Hours', durationHours, (v: number) => setDurationHours(Math.max(0, Math.min(23, v)))],
                              ['Mins', durationMinutes, (v: number) => setDurationMinutes(Math.max(0, Math.min(59, v)))],
                            ] as const).map(([label, value, set]) => (
                              <label key={label} className="space-y-1">
                                <span className="block text-[10px] font-bold text-gray-500 uppercase">{label}</span>
                                <input
                                  type="number"
                                  value={value}
                                  onChange={(e) => set(parseInt(e.target.value) || 0)}
                                  className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Banner icon={AlertCircle} className="bg-red-50 border-red-200 text-red-700" iconClass="text-red-600">
                          <p className="font-bold text-red-600">This cannot be undone</p>
                          <p className="mt-0.5">Deleting this user permanently removes their account from the system.</p>
                        </Banner>
                      )}
                      <textarea
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder={`Reason for ${actionLabel.toLowerCase()} (the user sees this)...`}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                      />
                      <div className="flex gap-3">
                        <button onClick={resetAction} className="flex-1 h-11 text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg">
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmAction}
                          disabled={isLoading}
                          className="flex-1 h-11 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                        >
                          Confirm {actionLabel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Or act on {reported.name}’s account</p>
                      <div className="grid grid-cols-4 gap-2">
                        {([
                          ['restrict', 'Restrict', Shield, 'text-orange-700 bg-orange-50 border-orange-100 hover:bg-orange-100'],
                          ['suspend', 'Suspend', Clock, 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100'],
                          ['ban', 'Ban', Ban, 'text-red-700 bg-red-50 border-red-100 hover:bg-red-100'],
                          ['delete', 'Delete', Trash2, 'text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100'],
                        ] as const).map(([action, label, Icon, style]) => (
                          <button
                            key={action}
                            onClick={() => setConfirmingAction(action)}
                            disabled={isLoading}
                            className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border rounded-lg disabled:opacity-50 transition-colors ${style}`}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
                {!reported?._id && (
                  <p className="text-xs text-gray-500 text-center">There is no account on this report to act on.</p>
                )}
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-white">
            <div className="flex items-center justify-center px-6 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 text-sm">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </SideModal>
  );
};

export default ReviewReportModal;
