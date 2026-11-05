import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search,
  MessageSquare,
  MessageCircleQuestion,
  CheckCircle2,
  Clock,
  UserCheck,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { SupportChatModal } from '../components/Modals';
import CounterGroups from '../components/UI/CounterGroups';
import type { CounterGroup } from '../components/UI/CounterGroups';
import { SortHeader, ListFooter, ago } from '../components/UI/ListControls';
import { supportService, jobsService } from '../services';
import type { DisputeFinding } from '../types/jobs.types';
import { useAuth } from '../context/AuthContext';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { useSupportSocket } from '../hooks/useSupportSocket';
import { getInitials } from '../utils';
import { buildTicketRows, hasPreviouslyResolved } from '../utils/supportHelpers';
import type { TicketRow } from '../utils/supportHelpers';
import type { ChatSupport, Message } from '../types';

/** How a resolved dispute was ruled — see DISPUTE_RESOLUTION_MAP server-side. */
const DISPUTE_OUTCOME_LABELS: Record<string, string> = {
  pay_provider: 'Provider paid',
  refund_client: 'Client refunded',
  rebook: 'Rebooked',
  no_show_payout: 'No-show payout',
};

type RowState = 'open' | 'pending' | 'resolved';
type View = 'all' | RowState | 'unread' | 'dispute';
type TypeFilter = 'all' | 'client' | 'provider';
type SortKey = 'activity_desc' | 'activity_asc';
const VIEWS: View[] = ['all', 'open', 'pending', 'resolved', 'unread', 'dispute'];

/**
 * Both threads of a dispute, or the one thread of anything else. A dispute
 * row stands for both parties, so its state, handler and activity come from
 * both.
 */
const threadsOf = (row: TicketRow): ChatSupport[] =>
  row.isDispute && row.provider && row.client ? [row.client, row.provider] : [row.primary];

/**
 * The same three states as the ticket's own badge (the backend's
 * displayStatus): open = nobody has picked it up, pending = an admin has it,
 * resolved = closed. A dispute is open while either thread is, and accepted
 * once either is (acceptance is case-wide).
 */
const stateOf = (row: TicketRow): RowState =>
  row.status === 'closed' ? 'resolved' : threadsOf(row).some((t) => t.acceptedBy) ? 'pending' : 'open';

const handlerOf = (row: TicketRow) =>
  threadsOf(row).map((t) => t.acceptedByName || t.assignedToName).find(Boolean) || null;

/** The latest message a user or admin can see (internal notes don't count). */
const lastActivityOf = (row: TicketRow) =>
  Math.max(
    ...threadsOf(row).map((t) => {
      const shown = (t.messages || []).filter((m) => !m.isInternal);
      const last = shown[shown.length - 1];
      return new Date(last?.timestamp || t.updatedAt || t.createdAt).getTime();
    }),
  );

const closedAtOf = (row: TicketRow) => {
  const times = threadsOf(row).map((t) => (t.closedAt ? new Date(t.closedAt).getTime() : 0));
  const latest = Math.max(...times);
  return latest > 0 ? new Date(latest) : null;
};

const BADGE: Record<RowState, { label: string; badge: string; dot: string }> = {
  open: { label: 'Open', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  pending: { label: 'Pending', badge: 'bg-yellow-50 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  resolved: { label: 'Resolved', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

const StatusBadge: React.FC<{ state: RowState; small?: boolean }> = ({ state, small }) => {
  const look = BADGE[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase whitespace-nowrap ${small ? 'px-2 py-0.5 text-[9px] tracking-tight' : 'px-2.5 py-1 text-[10px] tracking-wider'} ${look.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      {look.label}
    </span>
  );
};

const day = (value: Date | string) => format(new Date(value), 'MMM d');

/** The line under a status: how long it has waited, who has it, or how it ended. */
const statusLine = (row: TicketRow): { text: string; icon: LucideIcon; tone: string } => {
  const state = stateOf(row);
  if (state === 'open') {
    return { text: `Waiting ${formatDistanceToNowStrict(new Date(row.createdAt))}`, icon: Clock, tone: 'text-amber-600' };
  }
  if (state === 'pending') {
    const handler = handlerOf(row);
    return { text: handler ? `With ${handler}` : 'Picked up', icon: UserCheck, tone: 'text-gray-500' };
  }
  const closed = closedAtOf(row);
  const outcome = row.disputeOutcome ? DISPUTE_OUTCOME_LABELS[row.disputeOutcome] || row.disputeOutcome : null;
  return {
    text: [outcome || 'Resolved', closed ? day(closed) : ''].filter(Boolean).join(outcome ? ' · ' : ' '),
    icon: CheckCircle2,
    tone: 'text-gray-500',
  };
};

const StatusText: React.FC<{ row: TicketRow; className?: string }> = ({ row, className = '' }) => {
  const line = statusLine(row);
  const Icon = line.icon;
  return (
    <span className={`flex items-center gap-1 min-w-0 ${line.tone} ${className}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{line.text}</span>
    </span>
  );
};

const ROLE_TONE = { client: 'text-purple-600', provider: 'text-indigo-600' };
const roleOf = (t: ChatSupport) => (t.userType === 'provider' ? 'provider' : 'client');

const RoleLabel: React.FC<{ chat: ChatSupport; className?: string }> = ({ chat, className = '' }) => (
  <span className={`text-[9px] font-black uppercase tracking-wider ${ROLE_TONE[roleOf(chat)]} ${className}`}>
    {roleOf(chat) === 'provider' ? 'Provider' : 'Client'}
  </span>
);

const Avatar: React.FC<{ chat: ChatSupport }> = ({ chat }) =>
  chat.userProfileImage ? (
    <img src={chat.userProfileImage} alt={chat.userName || 'User'} className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-gray-100 flex-shrink-0">
      <span className="text-sm font-bold text-blue-600 uppercase">{getInitials(chat.userName || 'Unknown')}</span>
    </div>
  );

/** One side of a dispute: role, name, and whether they raised it. */
const DisputeParty: React.FC<{ chat: ChatSupport; raised: boolean }> = ({ chat, raised }) => (
  <div className="flex items-baseline gap-2 min-w-0" title={`${chat.userName || 'Unknown'} ${raised ? 'raised this dispute' : 'is the subject of this dispute'}`}>
    <span className={`w-[58px] flex-shrink-0 text-[9px] font-black uppercase tracking-wider ${ROLE_TONE[roleOf(chat)]}`}>{roleOf(chat) === 'provider' ? 'Provider' : 'Client'}</span>
    <span className="text-xs font-semibold text-gray-900 truncate">{chat.userName || 'Unknown'}</span>
    <span className={`text-[10px] font-semibold flex-shrink-0 ${raised ? 'text-amber-600' : 'text-gray-400'}`}>{raised ? 'raised it' : 'reported'}</span>
  </div>
);

const PRIORITY_WORD: Record<string, { text: string; tone: string }> = {
  urgent: { text: 'Urgent', tone: 'text-red-600 font-semibold' },
  high: { text: 'High priority', tone: 'text-orange-600 font-semibold' },
};

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Support Page
 * One row per conversation — a job dispute's two threads are one row. The
 * same counters, rows and footer as the other list pages: where each ticket
 * stands, what needs a look, and account type; every number is the rows
 * clicking it shows. The chat panel opens on click, as before.
 */
const Support: React.FC = () => {
  const { user } = useAuth();
  const [selectedChat, setSelectedChat] = useState<ChatSupport | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingChatId, setSendingChatId] = useState<string | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  selectedChatIdRef.current = selectedChat?._id || null;
  const sendingMessage = selectedChat?._id === sendingChatId;

  const {
    tickets,
    loading,
    isPlaceholderData,
    fetchTickets,
    updateTicket,
    acceptTicket,
    closeTicket,
    reopenTicket
  } = useSupportTickets();

  const selectRequestIdRef = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  // Which deep link has already been honoured, so the effect below does not
  // reopen the ticket every time the list refreshes underneath it.
  const deepLinkedRef = useRef<string | null>(null);

  const handleNewMessage = useCallback((data: any) => {
    const { chatSupportId, message: newMessage } = data;
    console.log('[handleNewMessage] Received:', { chatSupportId, newMessage });
    if (!newMessage) return;

    // Check for duplicates before adding
    const currentTicket = tickets.find(t => t._id === chatSupportId);
    const messageExists = currentTicket?.messages?.some(m => m._id === newMessage._id);

    if (!messageExists) {
      // A user message on a thread the admin isn't looking at bumps its
      // unread badge; opening the thread clears it (server marks read).
      const isUnreadUserMessage =
        newMessage.senderType === 'User' && selectedChat?._id !== chatSupportId;
      updateTicket(chatSupportId, {
        messages: [...(currentTicket?.messages?.filter(m => !m._id?.startsWith('temp-')) || []), newMessage],
        updatedAt: new Date().toISOString(),
        ...(isUnreadUserMessage
          ? { unreadCount: (currentTicket?.unreadCount || 0) + 1 }
          : {})
      });
    }

    if (selectedChat?._id === chatSupportId) {
      setSelectedChat(prev => {
        if (!prev) return prev;

        // Check if message already exists in selectedChat
        const alreadyExists = prev.messages?.some(m => m._id === newMessage._id);
        if (alreadyExists) {
          console.log('[handleNewMessage] Message already exists, skipping duplicate');
          return prev;
        }

        const filteredMessages = prev.messages?.filter(m => !m._id?.startsWith('temp-')) || [];
        console.log('[handleNewMessage] Updating selectedChat. Filtered:', filteredMessages.length, 'Adding:', 1);
        return {
          ...prev,
          messages: [...filteredMessages, newMessage],
          updatedAt: new Date().toISOString()
        };
      });
    }
  }, [updateTicket, selectedChat, tickets]);

  const handleChatUpdate = useCallback((data: any) => {
    const { chatSupportId, updates } = data;
    updateTicket(chatSupportId, updates);

    if (selectedChat?._id === chatSupportId) {
      setSelectedChat(prev => prev ? { ...prev, ...updates } : prev);
    }
  }, [updateTicket, selectedChat]);

  const {
    joinChat,
    leaveChat
  } = useSupportSocket(handleNewMessage, handleChatUpdate, fetchTickets);

  const handleSelectChat = async (chat: ChatSupport) => {
    const requestId = ++selectRequestIdRef.current;

    // Switching threads directly (e.g. dispute counterpart button) — leave
    // the previous socket room first.
    if (selectedChat && selectedChat._id !== chat._id) {
      leaveChat(selectedChat._id);
    }

    try {
      const data = await supportService.getChatSupportById(chat._id);
      if (requestId !== selectRequestIdRef.current) return;

      setSelectedChat(data.chatSupport);
      setIsChatModalOpen(true);
      joinChat(chat._id);
      // Opening the thread marked the user's messages read server-side.
      updateTicket(chat._id, { unreadCount: 0 });
    } catch (error) {
      if (requestId !== selectRequestIdRef.current) return;

      console.error('Error loading support conversation:', error);
      setSelectedChat(chat);
      setIsChatModalOpen(true);
    }
  };

  const closeChatModal = () => {
    selectRequestIdRef.current += 1;
    if (selectedChat) {
      leaveChat(selectedChat._id);
    }
    setIsChatModalOpen(false);
    setTimeout(() => {
      setSelectedChat(null);
      setMessage('');
    }, 300);
  };

  /**
   * Open the ticket named by `?id=` (or `?ticketId=`) on arrival, so a link
   * from elsewhere in the admin — a user's activity history, a dashboard alert
   * — lands on the conversation itself rather than just the ticket list.
   *
   * Falls back to fetching the ticket directly when it is not among the loaded
   * rows: the list collapses each dispute's two threads into one entry, so a
   * counterpart thread is reachable by id but never appears as a row of its own.
   */
  useEffect(() => {
    const targetId = searchParams.get('id') || searchParams.get('ticketId');
    if (!targetId || loading) return;
    if (deepLinkedRef.current === targetId) return;
    deepLinkedRef.current = targetId;

    const clearParam = () => {
      searchParams.delete('id');
      searchParams.delete('ticketId');
      setSearchParams(searchParams, { replace: true });
    };

    const listed = tickets.find(
      (t: ChatSupport) => t._id === targetId || t.ticketId === targetId
    );

    if (listed) {
      handleSelectChat(listed);
      clearParam();
      return;
    }

    supportService
      .getChatSupportById(targetId)
      .then((data) => {
        setSelectedChat(data.chatSupport);
        setIsChatModalOpen(true);
        joinChat(data.chatSupport._id);
      })
      .catch((error) => {
        // 404 is also what the server returns for a ticket this admin may not
        // read, so ticket ids cannot be probed across support agents.
        console.error('Error opening linked support ticket:', error);
        toast.error(
          error?.response?.status === 404
            ? 'You do not have access to that ticket'
            : 'Failed to open that ticket'
        );
      })
      .finally(clearParam);
    // handleSelectChat is rebuilt every render; deepLinkedRef is what keeps
    // this from firing twice for the same link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, loading, searchParams]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChat || sendingMessage) return;

    const chatSupportId = selectedChat._id;
    const messageText = message.trim();
    setSendingChatId(chatSupportId);
    setMessage('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      senderType: 'Admin',
      senderName: user?.name || user?.username || 'Support Agent',
      message: messageText,
      timestamp: new Date().toISOString()
    };

    setSelectedChat(prev => {
      if (!prev || prev._id !== chatSupportId) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage]
      };
    });

    // Always send over HTTP — the response is the commit acknowledgment.
    // (The old socket emit was fire-and-forget: a flaky websocket silently
    // dropped messages.) Other admin viewers still receive the message via
    // the backend's change-stream broadcast; handleNewMessage dedupes by _id.
    try {
      const result = await supportService.sendMessage(chatSupportId, {
        message: messageText
      });

      setSelectedChat(prev => {
        if (!prev || prev._id !== chatSupportId) return prev;
        const withoutTemp = prev.messages?.filter(m => m._id !== tempId) || [];
        const alreadyExists = withoutTemp.some(m => m._id === result.message._id);
        return {
          ...prev,
          messages: alreadyExists ? withoutTemp : [...withoutTemp, result.message]
        };
      });
    } catch (error) {
      console.error('[handleSendMessage] Error sending message:', error);
      setSelectedChat(prev => {
        if (!prev || prev._id !== chatSupportId) return prev;
        return {
          ...prev,
          messages: prev.messages?.filter(m => m._id !== tempId) || []
        };
      });
      if (selectedChatIdRef.current === chatSupportId) {
        setMessage(messageText);
      }
      alert('Your message was not sent. Please try again.');
    } finally {
      setSendingChatId(current => current === chatSupportId ? null : current);
    }
  };

  // `reason` is the resolution note the admin must supply before resolving; it
  // is stored, logged, and shown to the customer. See supportService.closeTicket.
  const handleChatAction = async (chatSupportId: string, action: string, reason?: string) => {
    try {
      if (action === 'close') {
        await closeTicket({ ticketId: chatSupportId, reason });
        closeChatModal();
      } else if (action === 'reopen') {
        const result = await reopenTicket(chatSupportId);
        setSelectedChat(prev =>
          prev?._id === chatSupportId
            ? { ...prev, ...result.chatSupport }
            : prev
        );
      }
    } catch (error) {
      console.error(`Error ${action} ticket:`, error);
      throw error;
    }
  };

  // Threads an accept has been sent for, released only if it fails. The list
  // learns a dispute's threads are accepted a render before selectedChat does,
  // and the dispute-sync effect below — running late, against that render —
  // re-accepted the thread the admin had just accepted: a 409 on every dispute
  // picked up. Anything in here is never synced again.
  const acceptRequestedRef = useRef<Set<string>>(new Set());

  const handleAcceptTicket = async (chatSupportId: string) => {
    acceptRequestedRef.current.add(chatSupportId);
    try {
      const result = await acceptTicket(chatSupportId);
      // On a dispute the server accepts both parties' threads; the open one may
      // be either of them, so match against all of what came back.
      const accepted = [result.chatSupport, ...(result.linkedChatSupports || [])];
      accepted.forEach(c => acceptRequestedRef.current.add(c._id));
      setSelectedChat(prev => {
        const update = prev && accepted.find(c => c._id === prev._id);
        return update ? { ...prev, ...update } : prev;
      });
    } catch (error) {
      acceptRequestedRef.current.delete(chatSupportId);
      console.error('Error accepting ticket:', error);
      throw error;
    }
  };

  const refreshSelectedChat = async (chatSupportId: string) => {
    const data = await supportService.getChatSupportById(chatSupportId);
    setSelectedChat(prev =>
      prev?._id === chatSupportId ? data.chatSupport : prev
    );
    updateTicket(chatSupportId, data.chatSupport);
  };

  const handleResolveDispute = async (
    jobId: string,
    outcome: 'pay_provider' | 'refund_client' | 'rebook' | 'no_show_payout',
    note?: string,
    rebookDeadlineAt?: string,
    // Forwarded, not dropped: without this the finding controls in the modal
    // would render and change nothing, and every ruling would record "uncertain".
    finding?: DisputeFinding
  ) => {
    await jobsService.resolveDispute(jobId, outcome, note, rebookDeadlineAt, finding);
    if (selectedChat) {
      await refreshSelectedChat(selectedChat._id);
    }
  };

  const handleAddInternalNote = async (chatSupportId: string, note: string) => {
    await supportService.addInternalNote(chatSupportId, note);
    await refreshSelectedChat(chatSupportId);
  };

  // The other party's thread of the same dispute — raiseDispute files one
  // ChatSupport per party, cross-linked by metadata.jobId.
  const counterpartChat =
    selectedChat?.metadata?.kind === 'dispute' && selectedChat.metadata?.jobId
      ? tickets.find(
          t =>
            t._id !== selectedChat._id &&
            t.metadata?.kind === 'dispute' &&
            t.metadata?.jobId === selectedChat.metadata.jobId
        ) || null
      : null;

  // Acceptance is case-wide: the server accepts both threads of a dispute at
  // once. Disputes accepted before that was true (or whose counterpart was
  // filed later) can still be half-accepted — sync the straggler rather than
  // asking the admin to accept the same dispute a second time.
  useEffect(() => {
    if (!selectedChat || !counterpartChat) return;
    if (selectedChat.status !== 'open' || selectedChat.acceptedBy) return;
    if (!counterpartChat.acceptedBy) return;
    if (user?.role !== 'admin' && user?.role !== 'superadmin') return;
    if (acceptRequestedRef.current.has(selectedChat._id)) return;

    handleAcceptTicket(selectedChat._id).catch(error => {
      console.error('Error syncing dispute acceptance:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?._id, selectedChat?.acceptedBy, counterpartChat?.acceptedBy, user?.role]);

  // ── The list ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<SortKey>('activity_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // What's showing and account type live in the URL; they combine.
  const viewParam = (searchParams.get('status') || 'all') as View;
  const view: View = VIEWS.includes(viewParam) ? viewParam : 'all';
  const typeParam = searchParams.get('type') || 'all';
  const typeFilter: TypeFilter = typeParam === 'client' || typeParam === 'provider' ? typeParam : 'all';
  const setFilters = (nextView: View, nextType: TypeFilter) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === 'all') next.delete('status'); else next.set('status', nextView);
    if (nextType === 'all') next.delete('type'); else next.set('type', nextType);
    setSearchParams(next, { replace: true });
  };
  // Clicking the selected counter again lifts that filter.
  const chooseView = (next: View) => setFilters(next === view ? 'all' : next, typeFilter);
  const chooseType = (next: TypeFilter) => setFilters(view, next === typeFilter ? 'all' : next);

  const rows = useMemo(() => buildTicketRows(tickets), [tickets]);

  // Search narrows the counters as well as the list.
  const searched = useMemo(() => {
    const term = searchTerm.trim().toLowerCase().replace(/^#/, '');
    if (!term) return rows;
    return rows.filter((row) =>
      [row.jobTitle, row.jobId, ...threadsOf(row).flatMap((t) => [t.subject, t.category, t.userName, t.userEmail, t.ticketId, t._id])]
        .some((value) => String(value || '').toLowerCase().includes(term)),
    );
  }, [rows, searchTerm]);

  const matchesView = (row: TicketRow, v: View) =>
    v === 'all' ||
    (v === 'unread' ? row.unreadCount > 0 : v === 'dispute' ? row.isDispute && row.status !== 'closed' : stateOf(row) === v);
  // A dispute concerns a client and a provider, so it counts under both.
  const matchesType = (row: TicketRow, t: TypeFilter) => t === 'all' || threadsOf(row).some((thread) => roleOf(thread) === t);
  const countWhere = (v: View, t: TypeFilter) => searched.filter((row) => matchesView(row, v) && matchesType(row, t)).length;

  const filtered = useMemo(() => {
    const list = searched.filter((row) => matchesView(row, view) && matchesType(row, typeFilter));
    return [...list].sort((a, b) => (sort === 'activity_desc' ? lastActivityOf(b) - lastActivityOf(a) : lastActivityOf(a) - lastActivityOf(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, view, typeFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, view, typeFilter, sort, limit]);

  const totalPages = Math.ceil(filtered.length / limit);
  const pageRows = filtered.slice((page - 1) * limit, page * limit);
  const myId = user?.id || user?._id || user?.adminId;

  const viewCell = (key: View, label: string, tone: CounterGroup['cells'][number]['tone'], hint: string, alert?: boolean) => ({
    key,
    label,
    tone,
    hint,
    alert,
    count: loading ? undefined : countWhere(key, typeFilter),
    selected: view === key,
    onClick: () => chooseView(key),
  });
  const groups: CounterGroup[] = [
    {
      label: 'Status',
      cells: [
        viewCell('open', 'Open', 'blue', 'Nobody has picked these up yet'),
        viewCell('pending', 'Pending', 'yellow', 'An admin has these and is working on them'),
        viewCell('resolved', 'Resolved', 'emerald', 'Closed with a resolution note'),
      ],
    },
    {
      label: 'Needs a look',
      cells: [
        viewCell('unread', 'New replies', 'red', 'Messages from the user nobody has read yet', true),
        viewCell('dispute', 'Disputes', 'amber', 'Job disputes not ruled on yet', true),
      ],
    },
    {
      label: 'Account type',
      cells: ([
        { key: 'client', label: 'Customers', tone: 'purple', hint: 'Tickets from customers, and disputes involving one' },
        { key: 'provider', label: 'Providers', tone: 'indigo', hint: 'Tickets from providers, and disputes involving one' },
      ] as const).map((cell) => ({
        ...cell,
        count: loading ? undefined : countWhere(view, cell.key),
        selected: typeFilter === cell.key,
        onClick: () => chooseType(cell.key),
      })),
    },
  ];

  const anyFilterActive = Boolean(searchTerm) || view !== 'all' || typeFilter !== 'all' || sort !== 'activity_desc';
  const clearFilters = () => {
    setSearchTerm('');
    setSort('activity_desc');
    setFilters('all', 'all');
  };
  const waitingCount = countWhere('open', 'all');
  const emptyText = view === 'open' && !searchTerm
    ? { title: 'Nobody is waiting', text: 'Every ticket has been picked up.' }
    : view === 'unread' && !searchTerm
      ? { title: 'No new replies', text: 'Every message has been read.' }
      : { title: 'No tickets found', text: 'Try adjusting your search or filters.' };

  /** What the conversation is about: category (or dispute) above the subject, then the ticket. */
  const concernOf = (row: TicketRow) => {
    const chat = row.primary;
    const priority = PRIORITY_WORD[(chat.priority || '').toLowerCase()];
    return {
      label: row.isDispute ? 'Job dispute' : titleCase(chat.category || 'General'),
      // A dispute reads off the JOB: its two threads can carry different
      // subjects, so the primary thread's would depend on who reported.
      title: row.isDispute ? row.jobTitle || chat.subject.replace(/^Dispute:\s*/i, '') : chat.subject,
      ref: row.isDispute && row.jobId ? `Job #${row.jobId.slice(-6).toUpperCase()}` : `#${(chat.ticketId || chat._id.slice(-8)).toUpperCase()}`,
      priority,
    };
  };

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Support Center
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {loading ? 'Conversations with customers and providers' : `${rows.length.toLocaleString()} conversations with customers and providers`}
                {!loading && waitingCount > 0 && (
                  <span className="text-amber-600 font-semibold"> · {waitingCount} waiting for an admin</span>
                )}
              </p>
            </div>
          </div>

          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.8fr_3fr_2fr_2fr]"
            all={{ count: loading ? undefined : countWhere('all', 'all'), selected: view === 'all' && typeFilter === 'all', onClick: () => setFilters('all', 'all') }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="support-counters"
            idPrefix="support"
            allCell={{ label: 'All', hint: 'Every conversation; a dispute’s two threads count once' }}
          />
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it (search, then
            the order); from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <input
                type="text"
                data-testid="support-search"
                placeholder="Search by subject, name, email, ticket ID or job..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            </div>

            {/* Page Limit - phones (the desktop one sits by the pages) */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort tickets"
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value="activity_desc">Latest</option>
              <option value="activity_asc">Quietest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`flex-1 overflow-y-auto transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading support tickets...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="support-empty">
              <div className="text-gray-300 mb-4">
                <MessageCircleQuestion className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">{emptyText.title}</p>
              <p className="text-sm text-gray-500 mt-1">{emptyText.text}</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show every ticket
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative overflow-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className="w-[30%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        User
                      </th>
                      <th className="w-[30%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Concern
                      </th>
                      <th className="w-[22%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th
                        className="w-[18%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'activity_desc' ? 'descending' : 'ascending'}
                      >
                        <SortHeader
                          label="Activity"
                          dir={sort === 'activity_desc' ? 'desc' : 'asc'}
                          onClick={() => setSort(sort === 'activity_desc' ? 'activity_asc' : 'activity_desc')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {pageRows.map((row) => {
                      const chat = row.primary;
                      const concern = concernOf(row);
                      const parties = row.isDispute && row.reporter && row.reported;
                      return (
                        <tr
                          key={row.key}
                          data-testid={`support-ticket-row-${row.key}`}
                          onClick={() => handleSelectChat(chat)}
                          className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
                        >
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            {parties ? (
                              // Who raised it, then who it is against.
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                                  <Scale className="h-4 w-4 text-amber-600" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <DisputeParty chat={row.reporter!} raised />
                                  <DisputeParty chat={row.reported!} raised={false} />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar chat={chat} />
                                <div className="min-w-0">
                                  <RoleLabel chat={chat} />
                                  <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{chat.userName || 'Unknown'}</p>
                                  <p className="text-[11px] text-gray-500 truncate">{chat.userEmail || 'No email'}</p>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <p className={`text-[9px] font-black uppercase tracking-wider truncate ${row.isDispute ? 'text-amber-600' : 'text-gray-400'}`}>{concern.label}</p>
                            <p className="text-sm font-semibold text-gray-900 truncate" title={concern.title}>{concern.title}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              <span className="font-mono text-gray-400">{concern.ref}</span>
                              {concern.priority && <span className={concern.priority.tone}> · {concern.priority.text}</span>}
                            </p>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="flex flex-col items-start gap-1.5 min-w-0">
                              <StatusBadge state={stateOf(row)} />
                              <StatusText row={row} className="text-[11px] max-w-full" />
                              {hasPreviouslyResolved(chat, myId) && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-600" title="You resolved an earlier ticket in this conversation">
                                  <CheckCircle2 className="h-3 w-3" />
                                  You resolved one before
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <p className="text-xs font-bold text-gray-900 truncate">{ago(new Date(lastActivityOf(row)))}</p>
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500" title={row.isDispute ? 'Across both dispute threads' : undefined}>
                              <MessageSquare className="h-3 w-3 text-gray-400" />
                              {row.messageCount} message{row.messageCount === 1 ? '' : 's'}
                              {row.unreadCount > 0 && (
                                <span className="text-red-600 font-semibold" data-testid="support-row-unread"> · {row.unreadCount} new</span>
                              )}
                            </p>
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
                  {pageRows.map((row) => {
                    const chat = row.primary;
                    const concern = concernOf(row);
                    const parties = row.isDispute && row.reporter && row.reported;
                    return (
                      <div
                        key={row.key}
                        data-testid={`support-ticket-card-${row.key}`}
                        onClick={() => handleSelectChat(chat)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                          {parties ? (
                            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                              <Scale className="h-4 w-4 text-amber-600" />
                            </div>
                          ) : (
                            <Avatar chat={chat} />
                          )}
                          <div className="flex-1 min-w-0">
                            {parties ? (
                              <>
                                <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">Job dispute</p>
                                <p className="text-[13px] font-black text-gray-900 truncate leading-snug">
                                  {row.reporter!.userName || 'Unknown'} → {row.reported!.userName || 'Unknown'}
                                </p>
                              </>
                            ) : (
                              <>
                                <RoleLabel chat={chat} />
                                <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{chat.userName || 'Unknown'}</p>
                              </>
                            )}
                            <StatusText row={row} className="mt-1 text-[11px]" />
                          </div>
                          <StatusBadge state={stateOf(row)} small />
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-500 truncate">{concern.title}</p>
                          <div className="flex items-center gap-1 text-[9px] font-bold flex-shrink-0">
                            {row.unreadCount > 0 && <span className="text-red-600">{row.unreadCount} new ·</span>}
                            <span className="flex items-center gap-0.5 text-gray-400">
                              <Clock className="h-2.5 w-2.5" />
                              {ago(new Date(lastActivityOf(row)))}
                            </span>
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

        {!loading && filtered.length > 0 && (
          <ListFooter page={page} limit={limit} total={filtered.length} pages={totalPages} onPage={setPage} onLimit={setLimit} />
        )}
      </div>

      <SupportChatModal
        isOpen={isChatModalOpen}
        onClose={closeChatModal}
        selectedChat={selectedChat}
        message={message}
        setMessage={setMessage}
        sendMessage={handleSendMessage}
        sendingMessage={sendingMessage}
        handleChatAction={handleChatAction}
        handleAcceptTicket={handleAcceptTicket}
        onResolveDispute={handleResolveDispute}
        onAddInternalNote={handleAddInternalNote}
        counterpartChat={counterpartChat}
        onSwitchChat={handleSelectChat}
      />
    </div>
  );
};

export default Support;
