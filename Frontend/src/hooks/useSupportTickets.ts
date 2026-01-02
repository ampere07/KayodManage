import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportService } from '../services';
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
    staleTime: 2 * 60 * 1000,
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
        matchesTab = ticket.status === 'open' && !ticket.assignedTo && !ticket.acceptedBy;
      } else if (filters.activeTab === 'pending') {
        matchesTab = ticket.status === 'open' && (ticket.assignedTo || ticket.acceptedBy);
      } else if (filters.activeTab === 'resolved') {
        const hasResolvedInHistory = ticket.ticketHistory && ticket.ticketHistory.some(t => t.closedAt);
        const isCurrentlyClosed = ticket.status === 'closed';
        matchesTab = hasResolvedInHistory || isCurrentlyClosed;
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesTab && matchesUserType;
    });
  }, [tickets, filters]);

  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice(
      (pagination.page - 1) * pagination.limit,
      pagination.page * pagination.limit
    );
  }, [filteredTickets, pagination.page, pagination.limit]);

  const totalPages = Math.ceil(filteredTickets.length / pagination.limit);

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
      return { ticketId, chatSupport: result.chatSupport };
    },
    onSuccess: ({ ticketId, chatSupport }) => {
      updateTicket(ticketId, chatSupport);
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const result = await supportService.closeTicket(ticketId);
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
    paginatedTickets,
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
