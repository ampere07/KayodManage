import type { ChatSupport } from '../types';

/**
 * One row in the support table.
 *
 * A job dispute is filed as TWO ChatSupport documents — one thread per party,
 * cross-linked by metadata.jobId (see raiseDispute). Listing them raw puts two
 * near-identical rows in the table (same subject, same timestamp) and counts
 * every dispute twice. A row is therefore one ISSUE, not one document: normal
 * tickets map 1:1, dispute pairs collapse into a single row carrying both
 * parties.
 */
export interface TicketRow {
  /** Stable React key — the ticket id, or the job id for a dispute. */
  key: string;
  /** The thread opened when the row is clicked. */
  primary: ChatSupport;
  /** The other party's thread; null for everything except disputes. */
  counterpart: ChatSupport | null;
  isDispute: boolean;
  /** Both sides, resolved by role. Null on non-disputes. */
  provider: ChatSupport | null;
  client: ChatSupport | null;
  /** Who filed the complaint, and who it is against — from disputeRaisedBy. */
  reporter: ChatSupport | null;
  reported: ChatSupport | null;
  reporterRole: 'Client' | 'Provider' | null;
  reportedRole: 'Client' | 'Provider' | null;
  /** The job under dispute — two disputes between the same pair differ by this. */
  jobId: string | null;
  jobTitle: string | null;
  /** How it was ruled, once resolved: pay_provider | refund_client | rebook. */
  disputeOutcome: string | null;
  /** Totals across both threads, so a dispute reads as one issue. */
  messageCount: number;
  unreadCount: number;
  /** Open if EITHER side is still open — the dispute isn't done until both are. */
  status: string;
  createdAt: string | Date;
}

const isDisputeTicket = (t: ChatSupport) => t.metadata?.kind === 'dispute';

/**
 * Collapses dispute pairs into single rows and leaves everything else alone.
 * Input order is preserved: a dispute takes the position of whichever of its
 * two threads appeared first.
 */
export const buildTicketRows = (tickets: ChatSupport[]): TicketRow[] => {
  const rows: TicketRow[] = [];
  const claimed = new Set<string>();

  // Index the dispute halves by job so each pair can find its partner.
  const disputesByJob = new Map<string, ChatSupport[]>();
  for (const t of tickets) {
    const jobId = isDisputeTicket(t) && t.metadata?.jobId;
    if (!jobId) continue;
    const key = String(jobId);
    disputesByJob.set(key, [...(disputesByJob.get(key) || []), t]);
  }

  for (const ticket of tickets) {
    if (claimed.has(ticket._id)) continue;

    const jobId = isDisputeTicket(ticket) && ticket.metadata?.jobId;
    const pair = jobId ? disputesByJob.get(String(jobId)) || [] : [];

    // A dispute whose counterpart is missing from this list (filtered out, or
    // never created) still renders — as an ordinary single-party row — rather
    // than being dropped.
    if (pair.length < 2) {
      claimed.add(ticket._id);
      rows.push({
        key: ticket._id,
        primary: ticket,
        counterpart: null,
        isDispute: Boolean(jobId),
        provider: null,
        client: null,
        reporter: null,
        reported: null,
        reporterRole: null,
        reportedRole: null,
        jobId: jobId ? String(jobId) : null,
        jobTitle: ticket.metadata?.jobTitle || null,
        disputeOutcome: ticket.metadata?.disputeOutcome || null,
        messageCount: ticket.messages?.length || 0,
        unreadCount: ticket.unreadCount || 0,
        status: ticket.status,
        createdAt: ticket.createdAt,
      });
      continue;
    }

    pair.forEach((t) => claimed.add(t._id));

    // userType is populated from the users collection onto each thread; the
    // job's poster is always the client, so the two agree.
    const provider = pair.find((t) => t.userType === 'provider') || null;
    const client = pair.find((t) => t.userType !== 'provider') || null;

    // disputeRaisedBy names the side that complained; the other side is the one
    // being complained about.
    const raisedByProvider = ticket.metadata?.disputeRaisedBy === 'provider';
    const reporter = (raisedByProvider ? provider : client) || null;
    const reported = (raisedByProvider ? client : provider) || null;

    rows.push({
      key: `dispute:${jobId}`,
      // Open the reporter's thread — that's the side with the complaint. The
      // modal can switch to the other party.
      primary: reporter || ticket,
      counterpart: null,
      isDispute: true,
      provider,
      client,
      reporter,
      reported,
      reporterRole: raisedByProvider ? 'Provider' : 'Client',
      reportedRole: raisedByProvider ? 'Client' : 'Provider',
      jobId: String(jobId),
      jobTitle: ticket.metadata?.jobTitle || null,
      // Either thread may carry it; take whichever has one.
      disputeOutcome:
        pair.map((t) => t.metadata?.disputeOutcome).find(Boolean) || null,
      messageCount: pair.reduce((n, t) => n + (t.messages?.length || 0), 0),
      unreadCount: pair.reduce((n, t) => n + (t.unreadCount || 0), 0),
      status: pair.some((t) => t.status === 'open') ? 'open' : ticket.status,
      createdAt: pair
        .map((t) => t.createdAt)
        .sort()[0],
    });
  }

  return rows.map((row) => ({
    ...row,
    counterpart:
      row.isDispute && row.provider && row.client
        ? row.primary._id === row.provider._id
          ? row.client
          : row.provider
        : null,
  }));
};

export const hasPreviouslyResolved = (
  chat: ChatSupport,
  currentUserId: string | undefined
): boolean => {
  if (!currentUserId || !chat.ticketHistory || chat.ticketHistory.length === 0) {
    return false;
  }

  return chat.ticketHistory.some((ticket: any) =>
    ticket.resolvedBy && ticket.resolvedBy.toString() === currentUserId.toString()
  );
};

export const calculateTicketStats = (tickets: ChatSupport[]) => {
  const totalTickets = tickets.reduce((sum, chat) => {
    const historyCount = chat.ticketHistory?.length || 0;
    const currentTicket = 1;
    return sum + historyCount + currentTicket;
  }, 0);

  const totalMessages = tickets.reduce(
    (sum, chat) => sum + (chat.messages?.length || 0),
    0
  );

  const openTickets = tickets.filter(
    chat => chat.status === 'open' && !chat.acceptedBy
  ).length;

  const pendingTickets = tickets.filter(
    chat => chat.status === 'open' && chat.acceptedBy
  ).length;

  const unreadTickets = tickets.filter(
    chat => (chat.unreadCount || 0) > 0
  ).length;

  const resolvedTickets = tickets.reduce((sum, chat) => {
    const resolvedInHistory = chat.ticketHistory?.filter(t => t.closedAt).length || 0;
    const currentResolved = chat.status === 'closed' ? 1 : 0;
    return sum + resolvedInHistory + currentResolved;
  }, 0);

  const resolvedToday = tickets.reduce((sum, chat) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resolvedTodayInHistory = chat.ticketHistory?.filter(t => {
      if (!t.closedAt) return false;
      const closedDate = new Date(t.closedAt);
      closedDate.setHours(0, 0, 0, 0);
      return closedDate.getTime() === today.getTime();
    }).length || 0;

    let currentResolvedToday = 0;
    if (chat.status === 'closed' && chat.closedAt) {
      const closedDate = new Date(chat.closedAt);
      closedDate.setHours(0, 0, 0, 0);
      if (closedDate.getTime() === today.getTime()) {
        currentResolvedToday = 1;
      }
    }

    return sum + resolvedTodayInHistory + currentResolvedToday;
  }, 0);

  return {
    totalTickets,
    totalMessages,
    openTickets,
    pendingTickets,
    unreadTickets,
    resolvedTickets,
    resolvedToday
  };
};
