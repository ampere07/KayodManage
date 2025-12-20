import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  Calendar,
  MessageCircleQuestion,
  Send,
  Wifi,
  WifiOff,
  X,
  Eye
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

interface Message {
  _id?: string;
  senderType: 'Admin' | 'User';
  senderId?: string;
  senderName?: string;
  message: string;
  timestamp: string;
}

interface ChatSupport {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  subject: string;
  category: string;
  description?: string;
  status: 'open' | 'closed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  messages?: Message[];
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  unreadCount?: number;
}

const Support: React.FC = () => {
  const [chatSupports, setChatSupports] = useState<ChatSupport[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSupport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const joinedChats = useRef<Set<string>>(new Set());
  const selectedChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedChat) {
      selectedChatIdRef.current = selectedChat._id;
    } else {
      selectedChatIdRef.current = null;
    }
  }, [selectedChat?._id]);

  useEffect(() => {
    fetchChatSupports();
    setupSocket();
  }, []);

  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, [socket]);

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

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const fetchChatSupports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/support/chatsupports', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
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

  const handleSelectChat = async (chat: ChatSupport) => {
    try {
      const response = await fetch(`/api/support/chatsupports/${chat._id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedChat(data.chatSupport);
        setIsChatModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
      setSelectedChat(chat);
      setIsChatModalOpen(true);
    }
  };

  const closeChatModal = () => {
    setIsChatModalOpen(false);
    setTimeout(() => {
      setSelectedChat(null);
      setMessage('');
    }, 300);
  };

  const handleChatAction = async (chatSupportId: string, action: string) => {
    try {
      const response = await fetch(`/api/support/chatsupports/${chatSupportId}/${action}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (selectedChatIdRef.current === chatSupportId) {
          setSelectedChat(result.chatSupport);
        }
        setChatSupports(prev => prev.map(chat => 
          chat._id === chatSupportId ? result.chatSupport : chat
        ));
      }
    } catch (error) {
      console.error(`Error ${action} chat:`, error);
    }
  };

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
        const response = await fetch(`/api/support/chatsupports/${selectedChat._id}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText })
        });
        
        if (response.ok) {
          clearTimeout(timeoutId);
          const result = await response.json();
          
          setSelectedChat(prev => {
            if (!prev) return prev;
            const filtered = prev.messages?.filter(m => !m._id?.startsWith('temp-')) || [];
            return {
              ...prev,
              messages: [...filtered, result.message]
            };
          });
        } else {
          throw new Error('Failed to send message');
        }
        
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

  const filteredChatSupports = chatSupports.filter((chat) => {
    const matchesSearch = chat.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         chat.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (chat.userEmail && chat.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (chat.userName && chat.userName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || chat.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || chat.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityBadge = (priority: string) => {
    const configs = {
      urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
      low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' }
    };
    
    const config = configs[priority as keyof typeof configs] || configs.low;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'open' ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <Clock className="w-3 h-3 mr-1" />
        Open
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <XCircle className="w-3 h-3 mr-1" />
        Closed
      </span>
    );
  };

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
            <p className="text-xs md:text-sm text-gray-500 mt-1">{chatSupports.length} total tickets</p>
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

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search by subject, category, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
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
              <div className="hidden md:block bg-white overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
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
                    {filteredChatSupports.map((chat) => (
                      <tr 
                        key={chat._id}
                        onClick={() => handleSelectChat(chat)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-gray-700">
                                {getInitials(chat.userName || 'Unknown')}
                              </span>
                            </div>
                            <div className="ml-3">
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
                          {getStatusBadge(chat.status)}
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
                            {new Date(chat.createdAt).toLocaleDateString()}
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
                {filteredChatSupports.map((chat) => (
                  <div 
                    key={chat._id}
                    onClick={() => handleSelectChat(chat)}
                    className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-base font-semibold text-gray-700">
                          {getInitials(chat.userName || 'Unknown')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{chat.userName || 'Unknown'}</h3>
                        <p className="text-xs text-gray-500 truncate">{chat.userEmail || 'N/A'}</p>
                      </div>
                    </div>

                    <h4 className="text-sm font-medium text-gray-900 mb-2 truncate">{chat.subject}</h4>
                    <p className="text-xs text-gray-600 mb-3">{chat.category}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {getPriorityBadge(chat.priority)}
                      {getStatusBadge(chat.status)}
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
                        <span>{new Date(chat.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Modal */}
      {isChatModalOpen && selectedChat && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={closeChatModal}
          />
          
          <div className="fixed inset-0 md:left-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b bg-white">
              <div className="flex items-center justify-between">
                {/* Left: User Info */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedChat.userName || selectedChat.userEmail || 'Unknown User'}
                  </h3>
                  <span className="text-[10px] text-gray-500">KYD: {selectedChat.userId}</span>
                </div>
                
                {/* Right: Close Button */}
                <button
                  onClick={closeChatModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Ticket Info Button - Floating */}
              {!showSidePanel && (
                <button
                  onClick={() => setShowSidePanel(true)}
                  className="absolute top-4 right-4 p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors shadow-md z-10"
                  title="Ticket Information"
                >
                  <AlertCircle className="h-5 w-5" />
                </button>
              )}
              
              {/* Messages Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto bg-white">
                  <div className="px-6 py-4">
                    {(!selectedChat.messages || selectedChat.messages.length === 0) ? (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-base font-medium text-gray-600">No messages yet</p>
                          <p className="text-sm text-gray-500">Start the conversation!</p>
                        </div>
                      </div>
                    ) : (
                      selectedChat.messages.map((msg, index) => {
                        const isTemp = msg._id?.startsWith('temp-');
                        const isAdmin = msg.senderType === 'Admin';
                        const currentDate = new Date(msg.timestamp);
                        const previousDate = index > 0 ? new Date(selectedChat.messages![index - 1].timestamp) : null;
                        
                        const showDateSeparator = !previousDate || 
                          currentDate.toDateString() !== previousDate.toDateString();
                        
                        const getDateLabel = (date: Date) => {
                          const today = new Date();
                          const yesterday = new Date(today);
                          yesterday.setDate(yesterday.getDate() - 1);
                          
                          if (date.toDateString() === today.toDateString()) {
                            return 'Today';
                          } else if (date.toDateString() === yesterday.toDateString()) {
                            return 'Yesterday';
                          } else {
                            return date.toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric' 
                            });
                          }
                        };
                        
                        // Check if this message should be grouped with the previous one
                        const previousMsg = index > 0 ? selectedChat.messages![index - 1] : null;
                        const nextMsg = index < selectedChat.messages!.length - 1 ? selectedChat.messages![index + 1] : null;
                        
                        const isGroupedWithPrevious = previousMsg && 
                          previousMsg.senderType === msg.senderType &&
                          (currentDate.getTime() - new Date(previousMsg.timestamp).getTime()) < 5 * 60 * 1000 &&
                          currentDate.toDateString() === new Date(previousMsg.timestamp).toDateString();
                        
                        const isGroupedWithNext = nextMsg &&
                          nextMsg.senderType === msg.senderType &&
                          (new Date(nextMsg.timestamp).getTime() - currentDate.getTime()) < 5 * 60 * 1000 &&
                          currentDate.toDateString() === new Date(nextMsg.timestamp).toDateString();
                        
                        const showSenderName = !isGroupedWithPrevious;
                        const showTimestamp = !isGroupedWithNext;
                        
                        return (
                          <React.Fragment key={msg._id || index}>
                            {showDateSeparator && (
                              <div className="flex items-center justify-center my-4">
                                <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                  {getDateLabel(currentDate)}
                                </div>
                              </div>
                            )}
                            <div
                              className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} ${isGroupedWithNext ? 'mb-1' : 'mb-3'}`}
                              style={{ opacity: isTemp ? 0.6 : 1 }}
                            >
                              <div className={`max-w-sm ${
                                isAdmin ? 'text-right' : 'text-left'
                              }`}>
                                <div className={`inline-block px-4 py-2.5 rounded-2xl ${
                                  isAdmin 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-gray-100 text-gray-900'
                                }`}>
                                  {showSenderName && (
                                    <p className={`text-xs font-semibold mb-1 ${
                                      isAdmin ? 'text-blue-100' : 'text-gray-700'
                                    }`}>
                                      {msg.senderName || (isAdmin ? 'Support Agent' : selectedChat.userName || 'User')}
                                    </p>
                                  )}
                                  <p className="text-sm leading-relaxed">{msg.message}</p>
                                </div>
                                {showTimestamp && (
                                  <p className={`text-xs mt-1 px-1 ${
                                    isAdmin ? 'text-gray-500 text-right' : 'text-gray-500 text-left'
                                  }`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })
                    )}
                    <div ref={messageEndRef} />
                  </div>
                </div>

                {/* Message Input */}
                {selectedChat.status === 'open' && (
                  <div className="flex-shrink-0 p-4 border-t bg-white">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write a message..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !sendingMessage) {
                            sendMessage();
                          }
                        }}
                        disabled={sendingMessage}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!message.trim() || sendingMessage}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        {sendingMessage ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Side Panel */}
              {showSidePanel && (
                <div className="w-96 border-l border-gray-200 bg-white flex-shrink-0 overflow-y-auto">
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">Ticket Information</h3>
                        <button
                          onClick={() => setShowSidePanel(false)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">TID: {selectedChat._id}</p>
                    </div>

                    {/* User Info Section */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                            <span className="text-base font-semibold text-gray-700">
                              {getInitials(selectedChat.userName || selectedChat.userEmail || 'Unknown')}
                            </span>
                          </div>
                          
                          {/* Name and KYD */}
                          <div>
                            <p className="text-base font-semibold text-gray-900">{selectedChat.userName || 'Unknown'}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">KYD: {selectedChat.userId}</p>
                          </div>
                        </div>
                        
                        {/* Status and Category */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-900">Status:</span>
                            {getStatusBadge(selectedChat.status)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-900">Category:</span>
                            <span className="text-sm font-semibold text-gray-900">{selectedChat.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subject Section */}
                    <div className="px-6 py-4 border-b border-gray-200">
                      <label className="text-base font-semibold text-gray-900 block mb-2">Subject:</label>
                      <p className="text-sm text-gray-700">{selectedChat.subject}</p>
                    </div>

                    {/* Description Section */}
                    <div className="px-6 py-4 border-b border-gray-200 flex-1">
                      <label className="text-base font-semibold text-gray-900 block mb-2">Description:</label>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedChat.description || 'No description provided'}
                      </p>
                    </div>

                    {/* Dates Section */}
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="mb-3">
                        <label className="text-base font-semibold text-gray-900 block mb-1">Created:</label>
                        <p className="text-sm text-gray-700">
                          {new Date(selectedChat.createdAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <div>
                        <label className="text-base font-semibold text-gray-900 block mb-1">Last Update:</label>
                        <p className="text-sm text-gray-700">
                          {selectedChat.updatedAt ? new Date(selectedChat.updatedAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="p-6">
                      {selectedChat.status === 'open' ? (
                        <button
                          onClick={() => handleChatAction(selectedChat._id, 'close')}
                          className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-900 rounded-lg hover:bg-gray-50 text-base font-medium transition-colors"
                        >
                          Close Ticket
                        </button>
                      ) : (
                        <button
                          onClick={() => handleChatAction(selectedChat._id, 'reopen')}
                          className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-900 rounded-lg hover:bg-gray-50 text-base font-medium transition-colors"
                        >
                          Reopen Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Support;
