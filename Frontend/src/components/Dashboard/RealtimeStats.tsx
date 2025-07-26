import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Server, Database } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface RealtimeStatsProps {
  socket: Socket | null;
}

const RealtimeStats: React.FC<RealtimeStatsProps> = ({ socket }) => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [serverHealth, setServerHealth] = useState<any>(null);

  useEffect(() => {
    if (socket) {
      socket.on('connect', () => {
        setConnectionStatus('connected');
      });

      socket.on('disconnect', () => {
        setConnectionStatus('disconnected');
      });

      socket.on('connection:status', (status) => {
        setConnectionStatus('connected');
      });

      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connection:status');
      };
    }
  }, [socket]);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setServerHealth(data);
      } catch (error) {
        setServerHealth(null);
      }
    };

    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />;
      default:
        return <Wifi className="h-4 w-4 animate-pulse" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">System Status</h3>
        <div className="flex items-center space-x-4">
          {/* Real-time Connection */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getConnectionColor()}`}>
            {getConnectionIcon()}
            <span className="text-xs font-medium">
              {connectionStatus === 'connected' ? 'Live Updates' : 
               connectionStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'}
            </span>
          </div>

          {/* Server Health */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
            serverHealth ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
          }`}>
            <Server className="h-4 w-4" />
            <span className="text-xs font-medium">
              {serverHealth ? 'Server Online' : 'Server Offline'}
            </span>
          </div>

          {/* Database Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
            serverHealth?.mongodb === 'connected' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
          }`}>
            <Database className="h-4 w-4" />
            <span className="text-xs font-medium">
              {serverHealth?.mongodb === 'connected' ? 'Database Online' : 'Database Offline'}
            </span>
          </div>
        </div>
      </div>

      {serverHealth && (
        <div className="mt-3 text-xs text-gray-500">
          <span>Uptime: {Math.floor(serverHealth.uptime / 3600)}h {Math.floor((serverHealth.uptime % 3600) / 60)}m</span>
        </div>
      )}
    </div>
  );
};

export default RealtimeStats;