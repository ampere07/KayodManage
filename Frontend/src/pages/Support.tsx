import React, { useState, useCallback, useRef } from 'react';
import {
  Search,
  MessageSquare,
  CheckCircle,
  Calendar,
  MessageCircleQuestion,
  Eye,
  Clock,
  Filter
} from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import { SupportChatModal } from '../components/Modals';
import { supportService } from '../services';
import { useAuth } from '../context/AuthContext';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { useSupportSocket } from '../hooks/useSupportSocket';
import { getInitials, getStatusBadge } from '../utils';
import { hasPreviouslyResolved, calculateTicketStats } from '../utils/supportHelpers';
import type { ChatSupport, Message } from '../types';

const Support: React.FC = () => {
  const { user } = useAuth();
  const [selectedChat, setSelectedChat] = useState<ChatSupport | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const {
    tickets,
    paginatedTickets,
    filteredTickets,
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
  } = useSupportTickets();

  // Store timeout IDs to clear them when messages arrive
  const messageTimeoutsRef = useRef<Map<string, number>>(new Map());

  const handleNewMessage = useCallback((data: any) => {
    const { chatSupportId, message: newMessage } = data;
    console.log('[handleNewMessage] Received:', { chatSupportId, newMessage });
    if (!newMessage) return;

    // Clear any pending timeouts for this chat
    const timeoutId = messageTimeoutsRef.current.get(chatSupportId);
    if (timeoutId) {
      console.log('[handleNewMessage] Clearing timeout for chat:', chatSupportId);
      clearTimeout(timeoutId);
      messageTimeoutsRef.current.delete(chatSupportId);
    } else {
      console.log('[handleNewMessage] No timeout found for chat:', chatSupportId);
    }

    setSendingMessage(false);

    // Check for duplicates before adding
    const currentTicket = tickets.find(t => t._id === chatSupportId);
    const messageExists = currentTicket?.messages?.some(m => m._id === newMessage._id);

    if (!messageExists) {
      updateTicket(chatSupportId, {
        messages: [...(currentTicket?.messages?.filter(m => !m._id?.startsWith('temp-')) || []), newMessage],
        updatedAt: new Date().toISOString()
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
    isConnected,
    sendMessage: socketSendMessage,
    joinChat,
    leaveChat
  } = useSupportSocket(handleNewMessage, handleChatUpdate, fetchTickets);

  const handleSelectChat = async (chat: ChatSupport) => {
    try {
      const data = await supportService.getChatSupportById(chat._id);
      setSelectedChat(data.chatSupport);
      setIsChatModalOpen(true);
      joinChat(chat._id);
    } catch (error) {
      setSelectedChat(chat);
      setIsChatModalOpen(true);
    }
  };

  const closeChatModal = () => {
    if (selectedChat) {
      leaveChat(selectedChat._id);
    }
    setIsChatModalOpen(false);
    setTimeout(() => {
      setSelectedChat(null);
      setMessage('');
    }, 300);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChat || sendingMessage) return;

    const messageText = message.trim();
    console.log('[handleSendMessage] Sending message:', messageText, 'to chat:', selectedChat._id);
    setSendingMessage(true);
    setMessage('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      senderType: 'Admin',
      senderName: 'Support Agent',
      message: messageText,
      timestamp: new Date().toISOString()
    };

    console.log('[handleSendMessage] Adding optimistic message with tempId:', tempId);
    setSelectedChat(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage]
      };
    });

    const timeoutId = setTimeout(() => {
      console.log('[TIMEOUT FIRED] Removing temp message after 10s:', tempId);
      setSelectedChat(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages?.filter(m => m._id !== tempId) || []
        };
      });
      setMessage(messageText);
      setSendingMessage(false);
      messageTimeoutsRef.current.delete(selectedChat._id);
    }, 10000);

    // Store the timeout ID so it can be cleared when the message arrives
    messageTimeoutsRef.current.set(selectedChat._id, timeoutId);
    console.log('[handleSendMessage] Timeout set and stored for chat:', selectedChat._id);

    try {
      if (isConnected) {
        console.log('[handleSendMessage] Sending via socket...');
        socketSendMessage(selectedChat._id, messageText, 'Support Agent');
      } else {
        console.log('[handleSendMessage] Socket disconnected, using HTTP API...');
        const result = await supportService.sendMessage(selectedChat._id, { message: messageText });
        clearTimeout(timeoutId);
        messageTimeoutsRef.current.delete(selectedChat._id);

        setSelectedChat(prev => {
          if (!prev) return prev;
          const filtered = prev.messages?.filter(m => !m._id?.startsWith('temp-')) || [];
          return {
            ...prev,
            messages: [...filtered, result.message]
          };
        });

        setSendingMessage(false);
      }
    } catch (error) {
      console.error('[handleSendMessage] Error sending message:', error);
      clearTimeout(timeoutId);
      messageTimeoutsRef.current.delete(selectedChat._id);
      setSelectedChat(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages?.filter(m => m._id !== tempId) || []
        };
      });
      setMessage(messageText);
      setSendingMessage(false);
    }
  };

  const handleChatAction = async (chatSupportId: string, action: string) => {
    try {
      if (action === 'close') {
        await closeTicket(chatSupportId);
        closeChatModal();
      } else if (action === 'reopen') {
        await reopenTicket(chatSupportId);
      }
    } catch (error) {
      console.error(`Error ${action} ticket:`, error);
    }
  };

  const handleAcceptTicket = async (chatSupportId: string) => {
    try {
      await acceptTicket(chatSupportId);
    } catch (error) {
      console.error('Error accepting ticket:', error);
    }
  };

  const stats = calculateTicketStats(tickets);

  if (loading) {
    return (
      <div className="fixed inset-0 md:left-72 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-blue-600 animate-spin" />
            <MessageCircleQuestion className="absolute inset-0 m-auto h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          <div className="flex flex-col items-center italic">
            <p className="text-sm font-black text-gray-900 tracking-widest uppercase">Loading Support Tickets</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Establishing Secure Connection</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden text-gray-700">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Support Center
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Manage and respond to user support tickets, inquiries, and technical assistance requests
              </p>
            </div>
            

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'all' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}>
              <StatsCard
                title="Total Tickets"
                value={stats.totalTickets.toString()}
                icon={MessageSquare}
                color="blue"
                variant="tinted"
                isActive={filters.activeTab === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'open' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}>
              <StatsCard
                title="Open Tickets"
                value={stats.openTickets.toString()}
                icon={MessageCircleQuestion}
                color="orange"
                variant="tinted"
                isActive={filters.activeTab === 'open'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'pending' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}>
              <StatsCard
                title="Pending Response"
                value={stats.pendingTickets.toString()}
                icon={Clock}
                color="indigo"
                variant="tinted"
                isActive={filters.activeTab === 'pending'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'resolved' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}>
              <StatsCard
                title="Resolved"
                value={stats.resolvedTickets.toString()}
                icon={CheckCircle}
                color="green"
                variant="tinted"
                isActive={filters.activeTab === 'resolved'}
                smallIcon={true}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 w-full md:contents">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search tickets by ID, subject or customer..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm h-10"
              />
            </div>

            {/* Mobile-only Limit */}
            <div className="flex md:hidden items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, userTypeFilter: 'all' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                filters.userTypeFilter === 'all'
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, userTypeFilter: 'client' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                filters.userTypeFilter === 'client'
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, userTypeFilter: 'provider' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                filters.userTypeFilter === 'provider'
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Providers
            </button>
          </div>

            {/* Pagination Limit for Desktop */}
            <div className="hidden md:flex items-center gap-2 md:order-3 shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <MessageCircleQuestion className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No tickets found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white">
                <table className="min-w-full">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-10 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Messages</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedTickets.map((chat) => (
                      <tr
                        key={chat._id}
                        onClick={() => handleSelectChat(chat)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-2.5 whitespace-nowrap border-b border-gray-300">
                          <div className="flex items-center gap-3">
                            {chat.userProfileImage ? (
                              <img
                                src={chat.userProfileImage}
                                alt={chat.userName || 'User'}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-100"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                                <span className="text-sm font-bold text-blue-600 uppercase">
                                  {getInitials(chat.userName || 'Unknown')}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-gray-900 truncate">{chat.userName || 'Unknown'}</div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{chat.userEmail || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                          <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">{chat.subject}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                          <div className="text-sm text-gray-600">{chat.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center border-b border-gray-300">
                          <div className="flex items-center justify-center gap-2">
                            {getStatusBadge(chat.status, chat.acceptedBy, chat.displayStatus)}
                            {hasPreviouslyResolved(chat, user?.id || user?._id || user?.adminId) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100 shadow-sm shadow-purple-50/50" title="You previously resolved a ticket in this conversation">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Prev. Resolved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center border-b border-gray-300">
                          <div className="flex items-center justify-center gap-1">
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">{chat.messages?.length || 0}</span>
                            {(chat.unreadCount || 0) > 0 && (
                              <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                {chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                          <div className="text-xs text-gray-500">
                            {new Date(chat.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center border-b border-gray-300">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectChat(chat);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View chat"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden px-4 py-4 space-y-4">
                {paginatedTickets.map((chat) => (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectChat(chat)}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(chat.status, chat.acceptedBy, chat.displayStatus)}
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase tracking-widest">
                        {new Date(chat.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {chat.userProfileImage ? (
                          <img
                            src={chat.userProfileImage}
                            alt={chat.userName || 'User'}
                            className="h-10 w-10 rounded-full object-cover border border-gray-100 shadow-sm"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center border border-gray-100 shadow-sm">
                            <span className="text-sm font-bold text-blue-600">
                              {getInitials(chat.userName || 'Unknown')}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-gray-900 leading-tight mb-0.5">
                            {chat.userName || 'Unknown User'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 truncate">
                            {chat.userEmail || 'N/A'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-[9px] font-black text-gray-500 uppercase tracking-widest">
                              <MessageSquare className="h-2 w-2" />
                              {chat.messages?.length || 0} MESSAGES
                            </div>
                            {(chat.unreadCount || 0) > 0 && (
                              <div className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-black uppercase tracking-widest">
                                {chat.unreadCount} NEW
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 transition-colors">
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-dashed border-gray-100">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Subject</span>
                          <span className="text-xs font-black text-gray-900 line-clamp-2">{chat.subject}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Category</span>
                          <span className="text-xs font-bold text-indigo-600">{chat.category}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Ticket ID</span>
                          <span className="text-xs font-mono font-bold text-gray-500 uppercase">#{chat._id.slice(-6).toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Footer: Resolved Check */}
                      {hasPreviouslyResolved(chat, user?.id || user?._id || user?.adminId) && (
                        <div className="mt-4 pt-3 border-t border-dashed border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100" title="You previously resolved a ticket in this conversation">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Prev. Resolved
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700 text-center md:text-left">
                        Showing{' '}
                        <span className="font-medium">
                          {((pagination.page - 1) * pagination.limit) + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, filteredTickets.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{filteredTickets.length}</span> results
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                        disabled={pagination.page === totalPages}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
        chatSupports={tickets}
      />
    </div>
  );
};

export default Support;
