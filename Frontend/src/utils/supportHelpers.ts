import type { ChatSupport } from '../types';

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
