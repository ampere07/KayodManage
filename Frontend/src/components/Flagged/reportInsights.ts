import { differenceInCalendarDays, formatDistanceStrict, formatDistanceToNowStrict } from 'date-fns';
import type { CombinedReport, ReportParty } from '../../services/flaggedService';

/**
 * What a moderator wants at a glance about a report, worked out from the reports
 * already loaded on the Flagged page: how often this person (or job) has been
 * reported, the reporter's track record, whether the two have reported each
 * other, how long it has waited and what the decision was.
 */

export const isAwaiting = (report: CombinedReport) => report.status === 'open' || report.status === 'under_review';

/** What was done, in words (ACTIONS_TAKEN in reportTaxonomy.js). */
export const ACTION_TAKEN_LABELS: Record<string, string> = {
  none: 'No action',
  post_deleted: 'Post deleted',
  post_approved: 'Post kept',
  user_warned: 'User warned',
  user_restricted: 'User restricted',
  // Bans and deletions are also stored as user_suspended; outcomeOf reads the notes to tell them apart.
  user_suspended: 'User suspended',
  report_dismissed: 'No action needed',
  conversation_deleted: 'Conversation deleted',
  message_deleted: 'Message deleted',
  escalated_to_dispute: 'Sent to dispute',
};

/** The outcome line under a closed report's status. adminNotes says exactly what an account action was. */
export const outcomeOf = (report: CombinedReport): string | null => {
  if (report.status === 'escalated') return 'Sent to dispute';
  if (isAwaiting(report)) return null;
  const notes = report.adminNotes || '';
  // Account actions taken from a report record "User banned: …" etc. in the notes.
  const fromNotes = notes.match(/^(User (?:restricted|suspended|banned|deleted))\b/);
  if (fromNotes) return fromNotes[1];
  if (/^Post deleted|^Post was already removed/.test(notes)) return 'Post deleted';
  return ACTION_TAKEN_LABELS[report.actionTaken] || null;
};

/** Placeholder notes older code wrote on every decision — not worth showing. */
const BOILERPLATE_NOTES = /^(Action taken by admin)$/i;

/** The admin's own words on a report, without the old placeholder. */
export const meaningfulNotes = (report: CombinedReport) => {
  const notes = (report.adminNotes || '').trim();
  return notes && !BOILERPLATE_NOTES.test(notes) ? notes : '';
};

/**
 * The line under the status badge in the table: what was done for actioned and
 * escalated reports; for dismissed ones the badge already says it, so the
 * admin's note (if any) says why.
 */
export const tableOutcome = (report: CombinedReport): string | null => {
  if (report.status === 'dismissed') {
    const notes = meaningfulNotes(report);
    return notes ? `“${notes}”` : null;
  }
  return outcomeOf(report);
};

export const ROLE_LABELS: Record<string, string> = { client: 'Customer', provider: 'Provider', admin: 'Admin', superadmin: 'Superadmin' };

export const humanize = (text?: string | null) =>
  (text || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Open longer than this and a report is overdue. */
export const OVERDUE_DAYS = 7;

/**
 * "Waiting 4 months" for an open report (amber from 2 days, red once overdue);
 * "Decided in 3 days" for a closed one.
 */
export const ageLine = (report: CombinedReport): { text: string; tone: 'urgent' | 'warn' | 'muted' } | null => {
  const created = new Date(report.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  if (isAwaiting(report)) {
    const days = differenceInCalendarDays(new Date(), created);
    if (days < 2) return null;
    return { text: `Waiting ${formatDistanceToNowStrict(created)}`, tone: days > OVERDUE_DAYS ? 'urgent' : 'warn' };
  }
  if (report.reviewedAt) {
    return { text: `Decided in ${formatDistanceStrict(new Date(report.reviewedAt), created)}`, tone: 'muted' };
  }
  return null;
};

export interface ReportIndex {
  /** Reports naming this person as the reported party. */
  against: Map<string, CombinedReport[]>;
  /** Reports this person filed. */
  filedBy: Map<string, CombinedReport[]>;
  /** Reports about this job. */
  aboutJob: Map<string, CombinedReport[]>;
}

const push = (map: Map<string, CombinedReport[]>, key: string | undefined | null, report: CombinedReport) => {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(report);
  else map.set(key, [report]);
};

export const buildReportIndex = (reports: CombinedReport[]): ReportIndex => {
  const index: ReportIndex = { against: new Map(), filedBy: new Map(), aboutJob: new Map() };
  for (const report of reports) {
    push(index.against, report.reportedUserId?._id, report);
    push(index.filedBy, report.reportedBy?._id, report);
    if (report.reportType === 'job') push(index.aboutJob, report.job?._id, report);
  }
  return index;
};

/** How a person's reports were decided — a reporter whose reports are mostly dismissed reads differently. */
export const trackRecord = (reports: CombinedReport[] = []) => ({
  total: reports.length,
  awaiting: reports.filter(isAwaiting).length,
  dismissed: reports.filter((r) => r.status === 'dismissed').length,
  actioned: reports.filter((r) => r.status === 'action_taken' || r.status === 'escalated').length,
});

/** True when the reported person has also reported the reporter — often a dispute spilling over. */
export const isMutual = (report: CombinedReport, index: ReportIndex) => {
  const reporter = report.reportedBy?._id;
  const reported = report.reportedUserId?._id;
  if (!reporter || !reported) return false;
  return (index.filedBy.get(reported) || []).some((r) => r.reportedUserId?._id === reporter);
};

export const partyContact = (party?: ReportParty | null) => party?.email || party?.phoneNumber || '';
