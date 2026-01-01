import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSupportSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (chatSupportId: string, message: string, senderName: string) => void;
  joinChat: (chatSupportId: string) => void;
  leaveChat: (chatSupportId: string) => void;
}

export const useSupportSocket = (
  onNewMessage: (data: any) => void,
  onChatUpdate: (data: any) => void,
  onNewChat: () => void
): UseSupportSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const joinedChats = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newSocket = io('http://localhost:5000/admin', {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Support socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Support socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('connection:status', (status: string) => {
      setIsConnected(status === 'connected');
    });

    newSocket.on('support:new_message', onNewMessage);
    newSocket.on('support:chat_updated', onChatUpdate);
    newSocket.on('support:new_chat', onNewChat);
    newSocket.on('support:message_error', () => {
      console.error('Message send error');
    });

    setSocket(newSocket);

    return () => {
      joinedChats.current.forEach(chatId => {
        newSocket.emit('support:leave_chat', { chatSupportId: chatId });
      });
      joinedChats.current.clear();
      newSocket.disconnect();
    };
  }, [onNewMessage, onChatUpdate, onNewChat]);

  const joinChat = useCallback((chatSupportId: string) => {
    if (socket && isConnected) {
      socket.emit('support:join_chat', { chatSupportId });
      joinedChats.current.add(chatSupportId);
      console.log('Joined chat:', chatSupportId);
    }
  }, [socket, isConnected]);

  const leaveChat = useCallback((chatSupportId: string) => {
    if (socket) {
      socket.emit('support:leave_chat', { chatSupportId });
      joinedChats.current.delete(chatSupportId);
      console.log('Left chat:', chatSupportId);
    }
  }, [socket]);

  const sendMessage = useCallback((chatSupportId: string, message: string, senderName: string) => {
    if (socket && isConnected) {
      socket.emit('support:send_message', {
        chatSupportId,
        message,
        senderName,
        senderType: 'Admin'
      });
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    sendMessage,
    joinChat,
    leaveChat
  };
};
