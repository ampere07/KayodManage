import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportService } from '../services';
import { buildTicketRows } from '../utils/supportHelpers';
import type { ChatSupport } from '../types';

const SUPPORT_QUERY_KEY = 'support';

interface Filters {
  searchQuery: string;
  status: string;
  priority: string;
  activeTab: string;
  userTypeFilter: string;
}

export const useSupportTickets = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    status: 'all',
    priority: 'all',
    activeTab: 'all',
    userTypeFilter: 'all'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20
  });

  const { data: tickets = [], isLoading: loading } = useQuery({
    queryKey: [SUPPORT_QUERY_KEY],
    queryFn: async () => {
      const data = await supportService.getChatSupports();
      return data.chatSupports || [];
    },
    placeholderData: (previousData) => previousData,
  });

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket: ChatSupport) => {
      const matchesSearch =
        ticket.subject.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        ticket.category.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        (ticket.userEmail && ticket.userEmail.toLowerCase().includes(filters.searchQuery.toLowerCase())) ||
        (ticket.userName && ticket.userName.toLowerCase().includes(filters.searchQuery.toLowerCase()));

      const matchesStatus = filters.status === 'all' || ticket.status === filters.status;
      const matchesPriority = filters.priority === 'all' || ticket.priority === filters.priority;

      const matchesUserType = filters.userTypeFilter === 'all' || ticket.userType === filters.userTypeFilter;

      let matchesTab = true;
      if (filters.activeTab === 'open') {
        matchesTab = ticket.status === 'open' && !ticket.acceptedBy;
      } else if (filters.activeTab === 'pending') {
        matchesTab = ticket.status === 'open' && !!ticket.acceptedBy;
      } else if (filters.activeTab === 'resolved') {
        const hasResolvedInHistory = ticket.ticketHistory && ticket.ticketHistory.some(t => t.closedAt);
        const isCurrentlyClosed = ticket.status === 'closed';
        matchesTab = hasResolvedInHistory || isCurrentlyClosed;
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesTab && matchesUserType;
    });
  }, [tickets, filters]);

  // Collapse dispute pairs BEFORE paginating — grouping afterwards would let a
  // pair straddle a page boundary and render as two orphaned halves.
  const ticketRows = useMemo(
    () => buildTicketRows(filteredTickets),
    [filteredTickets]
  );

  const paginatedRows = useMemo(() => {
    return ticketRows.slice(
      (pagination.page - 1) * pagination.limit,
      pagination.page * pagination.limit
    );
  }, [ticketRows, pagination.page, pagination.limit]);

  const totalPages = Math.ceil(ticketRows.length / pagination.limit);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [filters]);

  const updateTicket = useCallback((ticketId: string, updates: Partial<ChatSupport>) => {
    queryClient.setQueryData([SUPPORT_QUERY_KEY], (oldData: ChatSupport[] = []) =>
      oldData.map(ticket =>
        ticket._id === ticketId ? { ...ticket, ...updates } : ticket
      )
    );
  }, [queryClient]);

  const acceptTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const result = await supportService.acceptTicket(ticketId);
      return {
        ticketId,
        chatSupport: result.chatSupport,
        // The other party's thread of the same dispute, accepted server-side
        // alongside this one.
        linkedChatSupports: result.linkedChatSupports || [],
      };
    },
    onSuccess: ({ ticketId, chatSupport, linkedChatSupports }) => {
      updateTicket(ticketId, chatSupport);
      linkedChatSupports.forEach(linked => updateTicket(linked._id, linked));
    },
  });

  // Takes an object rather than a bare id because mutateAsync's second argument
  // is MutateOptions — passing the reason positionally would be silently dropped.
  const closeTicketMutation = useMutation({
    mutationFn: async ({ ticketId, reason }: { ticketId: string; reason?: string }) => {
      const result = await supportService.closeTicket(ticketId, reason);
      return { ticketId, chatSupport: result.chatSupport };
    },
    onSuccess: ({ ticketId, chatSupport }) => {
      updateTicket(ticketId, chatSupport);
    },
  });

  const reopenTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const result = await supportService.reopenTicket(ticketId);
      return { ticketId, chatSupport: result.chatSupport };
    },
    onSuccess: ({ ticketId, chatSupport }) => {
      updateTicket(ticketId, chatSupport);
    },
  });

  const fetchTickets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [SUPPORT_QUERY_KEY] });
  }, [queryClient]);

  return {
    tickets,
    filteredTickets,
    // Rows, not raw tickets — dispute pairs are collapsed. Use ticketRows.length
    // (not filteredTickets.length) for "showing N of M".
    ticketRows,
    paginatedRows,
    loading,
    filters,
    pagination,
    totalPages,
    setFilters,
    setPagination,
    fetchTickets,
    updateTicket,
    acceptTicket: acceptTicketMutation.mutateAsync,
    closeTicket: closeTicketMutation.mutateAsync,
    reopenTicket: reopenTicketMutation.mutateAsync,
  };
};
