import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const configuredSocketUrl =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
const socketBaseUrl = configuredSocketUrl
  ? configuredSocketUrl.replace(/\/api\/?$/, '').replace(/\/$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:5000'
    : window.location.origin;

interface UseSupportSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
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

  // Use refs to store the latest callbacks without triggering re-renders
  const onNewMessageRef = useRef(onNewMessage);
  const onChatUpdateRef = useRef(onChatUpdate);
  const onNewChatRef = useRef(onNewChat);

  // Update refs when callbacks change
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onChatUpdateRef.current = onChatUpdate;
    onNewChatRef.current = onNewChat;
  }, [onNewMessage, onChatUpdate, onNewChat]);

  useEffect(() => {
    const newSocket = io(`${socketBaseUrl}/admin`, {
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

    // Use the refs instead of the callbacks directly
    newSocket.on('support:new_message', (data) => onNewMessageRef.current(data));
    newSocket.on('support:chat_updated', (data) => onChatUpdateRef.current(data));
    newSocket.on('support:new_chat', () => onNewChatRef.current());

    setSocket(newSocket);

    return () => {
      joinedChats.current.forEach(chatId => {
        newSocket.emit('support:leave_chat', { chatSupportId: chatId });
      });
      joinedChats.current.clear();
      newSocket.disconnect();
    };
  }, []); // Empty dependency array - only run once on mount

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

  return {
    socket,
    isConnected,
    joinChat,
    leaveChat
  };
};
