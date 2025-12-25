import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  Calendar,
  MessageCircleQuestion,
  Wifi,
  WifiOff,
  Eye
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';

// Component imports
import { SupportChatModal } from '../components/Modals';

// Service imports
import { supportService } from '../services';

// Type imports
import type { ChatSupport, Message } from '../types';

// Utility imports
import { getInitials, getPriorityBadge, getStatusBadge } from '../utils';

/**
 * Support Center Page
 * Manages support tickets and live chat with socket.io
 */
const Support: React.FC = () => {
  // State management
  const [chatSupports, setChatSupports] = useState<ChatSupport[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSupport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20
  });

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const joinedChats = useRef<Set<string>>(new Set());
  const selectedChatIdRef = useRef<string | null>(null);

  // Update selected chat ID ref
  useEffect(() => {
    if (selectedChat) {
      selectedChatIdRef.current = selectedChat._id;
    } else {
      selectedChatIdRef.current = null;
    }
  }, [selectedChat?._id]);

  // Initialize
  useEffect(() => {
    fetchChatSupports();
    setupSocket();
  }, []);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, [socket]);

  // Handle socket room management
  useEffect(() => {
    if (socket && isConnected) {
      joinedChats.current.forEach(chatId => {
        socket.emit('support:leave_chat', { chatSupportId: chatId });
      });
      joinedChats.current.clear();

      if (selectedChat) {
        socket.emit('support:join_chat', { chatSupportId: selectedChat._id });
        joinedChats.current.add(selectedChat._id);
      }
    }
  }, [selectedChat, socket, isConnected]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages]);

  /**
   * Scroll to bottom of messages
   */
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Cleanup socket connections
   */
  const cleanupSocket = () => {
    if (socket) {
      joinedChats.current.forEach(chatId => {
        socket.emit('support:leave_chat', { chatSupportId: chatId });
      });
      joinedChats.current.clear();

      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  /**
   * Setup socket.io connection
   */
  const setupSocket = () => {
    const newSocket = io('http://localhost:5000/admin', {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      setIsConnected(true);

      if (selectedChatIdRef.current) {
        newSocket.emit('support:join_chat', { chatSupportId: selectedChatIdRef.current });
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    newSocket.on('connection:status', (status: string) => {
      setIsConnected(status === 'connected');
    });

    newSocket.on('support:new_message', (data: any) => {
      handleNewMessage(data);
    });

    newSocket.on('support:chat_updated', (data: any) => {
      handleChatUpdate(data);
    });

    newSocket.on('support:new_chat', () => {
      fetchChatSupports();
    });

    newSocket.on('support:message_error', () => {
      setSendingMessage(false);
    });

    setSocket(newSocket);
  };

  /**
   * Handle incoming new message
   */
  const handleNewMessage = (data: any) => {
    const { chatSupportId, message: newMessage } = data;

    if (!newMessage) return;

    setSendingMessage(false);

    setChatSupports(prevChats => {
      return prevChats.map(chat => {
        if (chat._id === chatSupportId) {
          const currentMessages = chat.messages || [];
          const messageExists = currentMessages.some(
            (m: Message) => m._id === newMessage._id
          );

          if (messageExists) return chat;

          const filteredMessages = currentMessages.filter(
            (m: Message) => !m._id?.startsWith('temp-')
          );

          return {
            ...chat,
            messages: [...filteredMessages, newMessage],
            updatedAt: new Date().toISOString()
          };
        }
        return chat;
      });
    });

    if (selectedChatIdRef.current === chatSupportId) {
      setSelectedChat(prevChat => {
        if (!prevChat || prevChat._id !== chatSupportId) return prevChat;

        const currentMessages = prevChat.messages || [];
        const messageExists = currentMessages.some(
          (m: Message) => m._id === newMessage._id
        );

        if (messageExists) return prevChat;

        const filteredMessages = currentMessages.filter(
          (m: Message) => !m._id?.startsWith('temp-')
        );

        return {
          ...prevChat,
          messages: [...filteredMessages, newMessage],
          updatedAt: new Date().toISOString()
        };
      });
    }
  };

  /**
   * Handle chat update
   */
  const handleChatUpdate = (data: any) => {
    const { chatSupportId, updates } = data;

    setChatSupports(prev => prev.map(chat =>
      chat._id === chatSupportId
        ? { ...chat, ...updates, updatedAt: data.timestamp }
        : chat
    ));

    if (selectedChatIdRef.current === chatSupportId) {
      setSelectedChat(prev =>
        prev ? { ...prev, ...updates, updatedAt: data.timestamp } : prev
      );
    }
  };

  /**
   * Fetch all chat supports from API
   */
  const fetchChatSupports = async () => {
    try {
      setLoading(true);
      const data = await supportService.getChatSupports();
      const chats = data.chatSupports || [];
      setChatSupports(chats);

      if (selectedChatIdRef.current) {
        const updatedChat = chats.find((c: ChatSupport) => c._id === selectedChatIdRef.current);
        if (updatedChat) {
          setSelectedChat(updatedChat);
        }
      }
    } catch (error) {
      console.error('Error fetching chat supports:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle selecting a chat
   */
  const handleSelectChat = async (chat: ChatSupport) => {
    try {
      const data = await supportService.getChatSupportById(chat._id);
      setSelectedChat(data.chatSupport);
      setIsChatModalOpen(true);

      // Auto-accept ticket when admin opens it (if not already assigned)
      if (data.chatSupport.status === 'open' && !data.chatSupport.assignedTo && !data.chatSupport.acceptedBy) {
        handleAcceptTicket(data.chatSupport._id);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
      setSelectedChat(chat);
      setIsChatModalOpen(true);
    }
  };

  /**
   * Close chat modal
   */
  const closeChatModal = () => {
    setIsChatModalOpen(false);
    setTimeout(() => {
      setSelectedChat(null);
      setMessage('');
    }, 300);
  };

  /**
   * Handle chat actions (close, reopen, etc)
   */
  const handleChatAction = async (chatSupportId: string, action: string) => {
    try {
      const result = await supportService.performAction(chatSupportId, action);

      if (selectedChatIdRef.current === chatSupportId) {
        setSelectedChat(result.chatSupport);
      }
      setChatSupports(prev => prev.map(chat =>
        chat._id === chatSupportId ? result.chatSupport : chat
      ));
    } catch (error) {
      console.error(`Error ${action} chat:`, error);
    }
  };

  /**
   * Handle accepting a ticket
   */
  const handleAcceptTicket = async (chatSupportId: string) => {
    try {
      const result = await supportService.acceptTicket(chatSupportId);

      if (selectedChatIdRef.current === chatSupportId) {
        setSelectedChat(result.chatSupport);
      }
      setChatSupports(prev => prev.map(chat =>
        chat._id === chatSupportId ? result.chatSupport : chat
      ));
    } catch (error) {
      console.error('Error accepting ticket:', error);
    }
  };

  /**
   * Send a message
   */
  const sendMessage = async () => {
    if (!message.trim() || !selectedChat || sendingMessage) return;

    const messageText = message.trim();
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

    setSelectedChat(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage]
      };
    });

    const timeoutId = setTimeout(() => {
      setSelectedChat(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages?.filter(m => m._id !== tempId) || []
        };
      });
      setMessage(messageText);
      setSendingMessage(false);
    }, 10000);

    try {
      if (socket && isConnected) {
        socket.emit('support:send_message', {
          chatSupportId: selectedChat._id,
          message: messageText,
          senderName: 'Support Agent',
          senderType: 'Admin'
        });

        const messageHandler = (data: any) => {
          if (data.chatSupportId === selectedChat._id) {
            clearTimeout(timeoutId);
            socket.off('support:new_message', messageHandler);
          }
        };

        socket.on('support:new_message', messageHandler);
      } else {
        const result = await supportService.sendMessage(selectedChat._id, {
          message: messageText
        });

        clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      console.error('Error sending message:', error);
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

  /**
   * Filter chat supports based on search and filters
   */
  const filteredChatSupports = chatSupports.filter((chat) => {
    const matchesSearch = chat.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.userEmail && chat.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (chat.userName && chat.userName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || chat.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || chat.priority === filterPriority;

    // Tab filtering
    let matchesTab = true;
    if (activeTab === 'open') {
      // Open = tickets no admin has accepted yet (unassigned)
      matchesTab = chat.status === 'open' && !chat.assignedTo && !chat.acceptedBy;
    } else if (activeTab === 'pending') {
      // Pending = tickets accepted by an admin (assigned but not closed)
      matchesTab = chat.status === 'open' && (chat.assignedTo || chat.acceptedBy);
    } else if (activeTab === 'resolved') {
      // Resolved = tickets closed by an admin
      matchesTab = chat.status === 'closed';
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesTab;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchQuery, filterStatus, filterPriority, activeTab]);

  // Paginate filtered chats
  const paginatedChats = filteredChatSupports.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  );

  const totalPages = Math.ceil(filteredChatSupports.length / pagination.limit);

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 md:left-64 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Support Center</h1>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
                <Wifi className="w-4 h-4" />
                <span className="text-xs font-medium">Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs font-medium">Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Total Tickets</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{chatSupports.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {chatSupports.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0)} messages
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Open Tickets</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {chatSupports.filter(chat => chat.status === 'open' && !chat.assignedTo && !chat.acceptedBy).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Awaiting assignment</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Pending Response</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {chatSupports.filter(chat => chat.status === 'open' && (chat.assignedTo || chat.acceptedBy)).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {chatSupports.filter(chat => (chat.unreadCount || 0) > 0).length} with unread
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Resolved</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {chatSupports.filter(chat => chat.status === 'closed').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {chatSupports.filter(chat => {
                if (!chat.closedAt) return false;
                const closedDate = new Date(chat.closedAt);
                const today = new Date();
                return closedDate.toDateString() === today.toDateString();
              }).length} today
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
          >
            All Tickets
          </button>
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'open'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
          >
            Open ({chatSupports.filter(chat => chat.status === 'open' && !chat.assignedTo && !chat.acceptedBy).length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
          >
            Pending ({chatSupports.filter(chat => chat.status === 'open' && (chat.assignedTo || chat.acceptedBy)).length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'resolved'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
          >
            Resolved ({chatSupports.filter(chat => chat.status === 'closed').length})
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search tickets by subject, user, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {filteredChatSupports.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <MessageCircleQuestion className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No tickets found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Messages</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedChats.map((chat) => (
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
                          {getPriorityBadge(chat.priority)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getStatusBadge(chat.status, chat.assignedTo, chat.acceptedBy)}
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

              {/* Mobile Cards */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {paginatedChats.map((chat) => (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectChat(chat)}
                    className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {chat.userProfileImage ? (
                        <img
                          src={chat.userProfileImage}
                          alt={chat.userName || 'User'}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-base font-semibold text-gray-700">
                            {getInitials(chat.userName || 'Unknown')}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{chat.userName || 'Unknown'}</h3>
                        <p className="text-xs text-gray-500 truncate">{chat.userEmail || 'N/A'}</p>
                      </div>
                    </div>

                    <h4 className="text-sm font-medium text-gray-900 mb-2 truncate">{chat.subject}</h4>
                    <p className="text-xs text-gray-600 mb-3">{chat.category}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {getPriorityBadge(chat.priority)}
                      {getStatusBadge(chat.status, chat.assignedTo, chat.acceptedBy)}
                      {(chat.unreadCount || 0) > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          {chat.unreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{chat.messages?.length || 0} messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(chat.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                ))}  
              </div>

              {/* Pagination */}
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
                          {Math.min(pagination.page * pagination.limit, filteredChatSupports.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{filteredChatSupports.length}</span> results
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

      {/* Chat Modal */}
      <SupportChatModal
        isOpen={isChatModalOpen}
        onClose={closeChatModal}
        selectedChat={selectedChat}
        message={message}
        setMessage={setMessage}
        sendMessage={sendMessage}
        sendingMessage={sendingMessage}
        handleChatAction={handleChatAction}
        chatSupports={chatSupports}
      />
    </div>
  );
};

export default Support;
