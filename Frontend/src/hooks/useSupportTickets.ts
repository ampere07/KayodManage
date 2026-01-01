import { useState, useEffect, useCallback } from 'react';
import { supportService } from '../services';
import type { ChatSupport } from '../types';

interface Filters {
  searchQuery: string;
  status: string;
  priority: string;
  activeTab: string;
  userTypeFilter: string;
}

interface UseSupportTicketsReturn {
  tickets: ChatSupport[];
  filteredTickets: ChatSupport[];
  paginatedTickets: ChatSupport[];
  loading: boolean;
  filters: Filters;
  pagination: { page: number; limit: number };
  totalPages: number;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  setPagination: React.Dispatch<React.SetStateAction<{ page: number; limit: number }>>;
  fetchTickets: () => Promise<void>;
  updateTicket: (ticketId: string, updates: Partial<ChatSupport>) => void;
  acceptTicket: (ticketId: string) => Promise<void>;
  closeTicket: (ticketId: string) => Promise<void>;
  reopenTicket: (ticketId: string) => Promise<void>;
}

export const useSupportTickets = (): UseSupportTicketsReturn => {
  const [tickets, setTickets] = useState<ChatSupport[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supportService.getChatSupports();
      setTickets(data.chatSupports || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filteredTickets = tickets.filter((ticket) => {
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

  const paginatedTickets = filteredTickets.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  );

  const totalPages = Math.ceil(filteredTickets.length / pagination.limit);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [filters]);

  const updateTicket = useCallback((ticketId: string, updates: Partial<ChatSupport>) => {
    setTickets(prev => prev.map(ticket =>
      ticket._id === ticketId ? { ...ticket, ...updates } : ticket
    ));
  }, []);

  const acceptTicket = useCallback(async (ticketId: string) => {
    try {
      const result = await supportService.acceptTicket(ticketId);
      updateTicket(ticketId, result.chatSupport);
    } catch (error) {
      console.error('Error accepting ticket:', error);
      throw error;
    }
  }, [updateTicket]);

  const closeTicket = useCallback(async (ticketId: string) => {
    try {
      const result = await supportService.closeTicket(ticketId);
      updateTicket(ticketId, result.chatSupport);
    } catch (error) {
      console.error('Error closing ticket:', error);
      throw error;
    }
  }, [updateTicket]);

  const reopenTicket = useCallback(async (ticketId: string) => {
    try {
      const result = await supportService.reopenTicket(ticketId);
      updateTicket(ticketId, result.chatSupport);
    } catch (error) {
      console.error('Error reopening ticket:', error);
      throw error;
    }
  }, [updateTicket]);

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
    acceptTicket,
    closeTicket,
    reopenTicket
  };
};
