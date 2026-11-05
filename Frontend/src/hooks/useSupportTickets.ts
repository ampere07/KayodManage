import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportService } from '../services';
import type { ChatSupport } from '../types';

const SUPPORT_QUERY_KEY = 'support';

/**
 * Every support ticket, plus the ticket actions. The Support page groups,
 * counts, filters and pages them itself (see buildTicketRows), so this hook
 * only loads and updates the cache.
 */
export const useSupportTickets = () => {
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading: loading, isPlaceholderData } = useQuery({
    queryKey: [SUPPORT_QUERY_KEY],
    queryFn: async () => {
      const data = await supportService.getChatSupports();
      return data.chatSupports || [];
    },
    placeholderData: (previousData) => previousData,
  });

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
    loading,
    isPlaceholderData,
    fetchTickets,
    updateTicket,
    acceptTicket: acceptTicketMutation.mutateAsync,
    closeTicket: closeTicketMutation.mutateAsync,
    reopenTicket: reopenTicketMutation.mutateAsync,
  };
};
