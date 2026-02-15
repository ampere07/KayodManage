import React, { useState, useCallback, useRef } from 'react';
import {
  Search,
  MessageSquare,
  CheckCircle,
  Calendar,
  MessageCircleQuestion,
  Eye,
  Clock
} from 'lucide-react';
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
      <div className="fixed inset-0 md:left-72 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 md:top-0 md:left-72 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Support Center</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage and respond to user support tickets, inquiries, and technical assistance requests
            </p>
          </div>


        </div>

        <div className="grid grid-cols-2 gap-2 md:hidden mb-4">
          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'all' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-purple-50 border-purple-200 ${filters.activeTab === 'all' ? 'border-purple-400 ring-2 ring-purple-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Total</span>
            </div>
            <span className="text-sm font-bold text-purple-700">{stats.totalTickets}</span>
          </div>

          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'open' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-blue-50 border-blue-200 ${filters.activeTab === 'open' ? 'border-blue-400 ring-2 ring-blue-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Open</span>
            </div>
            <span className="text-sm font-bold text-blue-700">{stats.openTickets}</span>
          </div>

          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'pending' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-yellow-50 border-yellow-200 ${filters.activeTab === 'pending' ? 'border-yellow-400 ring-2 ring-yellow-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-700">Pending</span>
            </div>
            <span className="text-sm font-bold text-yellow-700">{stats.pendingTickets}</span>
          </div>

          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'resolved' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-green-50 border-green-200 ${filters.activeTab === 'resolved' ? 'border-green-400 ring-2 ring-green-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Resolved</span>
            </div>
            <span className="text-sm font-bold text-green-700">{stats.resolvedTickets}</span>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-4 gap-3 mb-4">
          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'all' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filters.activeTab === 'all' ? 'border-purple-500 ring-2 ring-purple-400 shadow-lg' : 'border-purple-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Total Tickets</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalTickets}</p>
          </div>

          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'open' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filters.activeTab === 'open' ? 'border-blue-500 ring-2 ring-blue-400 shadow-lg' : 'border-blue-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Open Tickets</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.openTickets}</p>
          </div>

          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'pending' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filters.activeTab === 'pending' ? 'border-yellow-500 ring-2 ring-yellow-400 shadow-lg' : 'border-yellow-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Pending Response</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.pendingTickets}</p>
          </div>

          <div
            onClick={() => {
              setFilters(prev => ({ ...prev, activeTab: 'resolved' }));
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filters.activeTab === 'resolved' ? 'border-green-500 ring-2 ring-green-400 shadow-lg' : 'border-green-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Resolved</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.resolvedTickets}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search tickets by subject, user, or ID..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, userTypeFilter: 'all' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filters.userTypeFilter === 'all'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, userTypeFilter: 'client' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filters.userTypeFilter === 'client'
                ? 'bg-purple-50 text-purple-700'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              Customer
            </button>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, userTypeFilter: 'provider' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filters.userTypeFilter === 'provider'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              Provider
            </button>
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
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Messages</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTickets.map((chat) => (
                      <tr
                        key={chat._id}
                        onClick={() => handleSelectChat(chat)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {chat.userProfileImage ? (
                              <img
                                src={chat.userProfileImage}
                                alt={chat.userName || 'User'}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0 mr-3"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mr-3">
                                <span className="text-sm font-semibold text-gray-700">
                                  {getInitials(chat.userName || 'Unknown')}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{chat.userName || 'Unknown'}</div>
                              <div className="text-xs text-gray-500 truncate max-w-[150px]">{chat.userEmail || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">{chat.subject}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{chat.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {getStatusBadge(chat.status, chat.acceptedBy, chat.displayStatus)}
                            {hasPreviouslyResolved(chat, user?.id || user?._id || user?.adminId) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700" title="You previously resolved a ticket in this conversation">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Prev. Resolved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500">
                            {new Date(chat.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
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
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    {/* Header: User Info & Status */}
                    <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {chat.userProfileImage ? (
                          <img
                            src={chat.userProfileImage}
                            alt={chat.userName || 'User'}
                            className="h-10 w-10 rounded-full object-cover border border-white shadow-sm"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 border border-white shadow-sm">
                            <span className="text-sm font-bold text-gray-700">
                              {getInitials(chat.userName || 'Unknown')}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">
                            {chat.userName || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-[150px]">
                            {chat.userEmail || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="scale-90 origin-right">
                          {getStatusBadge(chat.status, chat.acceptedBy, chat.displayStatus)}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Details */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Subject:</p>
                          <h3 className="text-sm font-bold text-gray-900 truncate">{chat.subject}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Category:</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{chat.category}</p>
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Created:</p>
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {new Date(chat.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                        {(chat.unreadCount || 0) > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            {chat.unreadCount} new
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3 h-3 text-gray-400" />
                          <span className="text-xs font-medium text-gray-900">{chat.messages?.length || 0} messages</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Resolved Check */}
                    {hasPreviouslyResolved(chat, user?.id || user?._id || user?.adminId) && (
                      <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700" title="You previously resolved a ticket in this conversation">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Prev. Resolved
                          </span>
                        </div>
                      </div>
                    )}
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
