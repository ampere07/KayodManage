import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
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
  WifiOff
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import '../styles/support.css';

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
        console.log('🔗 Joining chat room:', selectedChat._id);
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
      console.log('✅ Socket connected to admin namespace - ID:', newSocket.id);
      setIsConnected(true);
      
      if (selectedChatIdRef.current) {
        console.log('🔗 Rejoining chat room:', selectedChatIdRef.current);
        newSocket.emit('support:join_chat', { chatSupportId: selectedChatIdRef.current });
      }
    });
    
    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });
    
    newSocket.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });
    
    newSocket.on('connection:status', (status: string) => {
      console.log('Connection status:', status);
      setIsConnected(status === 'connected');
    });
    
    newSocket.on('support:new_message', (data: any) => {
      console.log('🔔 Socket event: support:new_message received', data);
      handleNewMessage(data);
    });
    
    newSocket.on('support:chat_updated', (data: any) => {
      handleChatUpdate(data);
    });
    
    newSocket.on('support:new_chat', (data: any) => {
      fetchChatSupports();
    });
    
    newSocket.on('support:joined_chat', (data: any) => {
      console.log('✅ Successfully joined chat room:', data.chatSupportId);
    });
    
    newSocket.on('support:message_error', (error: any) => {
      console.error('Message error:', error);
      setSendingMessage(false);
    });
    
    setSocket(newSocket);
  };

  const handleNewMessage = (data: any) => {
    const { chatSupportId, message: newMessage } = data;
    console.log('📨 Processing new message:', { chatSupportId, newMessage });
    
    if (!newMessage) {
      console.error('❌ No message in socket data!');
      return;
    }
    
    setSendingMessage(false);
    
    setChatSupports(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat._id === chatSupportId) {
          const currentMessages = chat.messages || [];
          const messageExists = currentMessages.some(
            (m: Message) => m._id === newMessage._id
          );
          
          if (messageExists) {
            console.log('ℹ️ Message already exists in chat list');
            return chat;
          }
          
          const filteredMessages = currentMessages.filter(
            (m: Message) => !m._id?.startsWith('temp-')
          );
          
          const updatedMessages = [...filteredMessages, newMessage];
          console.log('✅ Adding new message to chat list. Total messages:', updatedMessages.length);
          
          return {
            ...chat,
            messages: updatedMessages,
            updatedAt: new Date().toISOString()
          };
        }
        return chat;
      });
      return updatedChats;
    });
    
    if (selectedChatIdRef.current === chatSupportId) {
      console.log('🎯 Updating selected chat with new message');
      setSelectedChat(prevChat => {
        if (!prevChat || prevChat._id !== chatSupportId) {
          console.log('⚠️ Selected chat mismatch');
          return prevChat;
        }
        
        const currentMessages = prevChat.messages || [];
        const messageExists = currentMessages.some(
          (m: Message) => m._id === newMessage._id
        );
        
        if (messageExists) {
          console.log('ℹ️ Message already exists in selected chat');
          return prevChat;
        }
        
        const filteredMessages = currentMessages.filter(
          (m: Message) => !m._id?.startsWith('temp-')
        );
        
        const updatedMessages = [...filteredMessages, newMessage];
        console.log('✅ Updated selected chat. Total messages:', updatedMessages.length);
        
        return {
          ...prevChat,
          messages: updatedMessages,
          updatedAt: new Date().toISOString()
        };
      });
    } else {
      console.log('ℹ️ Message for different chat:', chatSupportId, 'Current:', selectedChatIdRef.current);
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
      console.log('📥 Loading chat:', chat._id);
      const response = await fetch(`/api/support/chatsupports/${chat._id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Chat loaded with messages:', data.chatSupport.messages?.length || 0);
        setSelectedChat(data.chatSupport);
      } else {
        console.log('⚠️ Failed to load chat details, using cached data');
        setSelectedChat(chat);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
      setSelectedChat(chat);
    }
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
      console.error('Message send timeout - no socket response');
    }, 10000);

    try {
      if (socket && isConnected) {
        console.log('📤 Sending message via socket:', { chatSupportId: selectedChat._id, message: messageText });
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
                         (chat.userEmail && chat.userEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || chat.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || chat.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-3 h-3 text-green-500" />;
      case 'closed': return <XCircle className="w-3 h-3 text-red-500" />;
      default: return <AlertCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <div className="bg-white border-b px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
            <p className="text-sm text-gray-600">Manage support conversations and help users</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1 text-green-600">
                <Wifi className="w-4 h-4" />
                <span className="text-xs">Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs">Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 w-full border bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <Filter className="w-4 h-4 text-gray-400" />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                  className="px-2 py-1.5 border bg-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 flex-1"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
                
                <select
                  value={filterPriority}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterPriority(e.target.value)}
                  className="px-2 py-1.5 border bg-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 flex-1"
                >
                  <option value="all">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar smooth-scroll">
              {filteredChatSupports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                  <MessageCircleQuestion className="w-12 h-12 mb-4 text-gray-300" />
                  <p className="text-base font-medium">No chats found</p>
                  <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredChatSupports.map((chat) => (
                    <div
                      key={chat._id}
                      onClick={() => handleSelectChat(chat)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
                        selectedChat?._id === chat._id 
                          ? 'bg-blue-50 shadow-sm ring-2 ring-blue-500' 
                          : 'bg-white hover:bg-gray-50 hover:shadow-sm'
                      }`}
                    >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm text-gray-900 truncate pr-2">
                        {chat.subject}
                      </h3>
                      {getStatusIcon(chat.status)}
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2 line-clamp-1">
                      {chat.category}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        getPriorityColor(chat.priority)}`}>
                        {chat.priority}
                      </span>
                      <span className="text-xs text-gray-500">
                        {chat.userEmail || chat.userName}
                      </span>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border flex flex-col h-full overflow-hidden">
          {selectedChat ? (
            <>
              <div className="p-3 border-b bg-gray-50 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">
                      {selectedChat.subject}
                    </h2>
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedChat.category}
                    </p>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {selectedChat.userName || selectedChat.userEmail || `User ID: ${selectedChat.userId}`}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(selectedChat.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(selectedChat.status)}
                        {selectedChat.status}
                      </div>
                      <div className="text-xs text-gray-400">
                        {selectedChat.messages?.length || 0} messages
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-2">
                    {selectedChat.status === 'open' && (
                      <button
                        onClick={() => handleChatAction(selectedChat._id, 'close')}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs"
                      >
                        Close Chat
                      </button>
                    )}
                    
                    {selectedChat.status === 'closed' && (
                      <button
                        onClick={() => handleChatAction(selectedChat._id, 'reopen')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
                      >
                        Reopen Chat
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 min-h-0 custom-scrollbar smooth-scroll">
                <div className="space-y-4">
                  {(!selectedChat.messages || selectedChat.messages.length === 0) ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    selectedChat.messages.map((msg, index) => {
                      const isTemp = msg._id?.startsWith('temp-');
                      return (
                        <div
                          key={msg._id || index}
                          className={`flex ${msg.senderType === 'Admin' ? 'justify-end' : 'justify-start'}`}
                          style={{ opacity: isTemp ? 0.7 : 1 }}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              msg.senderType === 'Admin' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white text-gray-900 border'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${
                                msg.senderType === 'Admin' ? 'text-blue-100' : 'text-gray-600'
                              }`}>
                                {msg.senderName || (msg.senderType === 'Admin' ? 'Admin' : 'User')}
                              </span>
                              {isTemp && (
                                <span className="text-xs opacity-75">Sending...</span>
                              )}
                            </div>
                            <p className="text-sm">{msg.message}</p>
                            <p className={`text-xs mt-1 ${
                              msg.senderType === 'Admin' ? 'text-blue-100' : 'text-gray-500'}`}>
                              {new Date(msg.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messageEndRef} />
                </div>
              </div>

              {selectedChat.status === 'open' && (
                <div className="p-4 border-t bg-white flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && !sendingMessage) {
                          sendMessage();
                        }
                      }}
                      disabled={sendingMessage}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!message.trim() || sendingMessage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingMessage ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircleQuestion className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Chat</h3>
                <p>Choose a support chat from the list to view details and messages</p>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
