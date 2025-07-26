import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (namespace: string = '') => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketUrl = namespace ? `http://localhost:5000/${namespace}` : 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log(`Connected to ${namespace || 'default'} namespace`);
    });

    newSocket.on('disconnect', () => {
      console.log(`Disconnected from ${namespace || 'default'} namespace`);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [namespace]);

  return socket;
};