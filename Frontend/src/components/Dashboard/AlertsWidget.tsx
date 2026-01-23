import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, X, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../../hooks/useSocket';

interface Alert {
  _id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  userId?: {
    name: string;
    email: string;
  };
  jobId?: {
    title: string;
  };
}

const AlertsWidget: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const socket = useSocket('admin');

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('alert:critical', (alert: Alert) => {
        setAlerts(prev => [alert, ...prev]);
      });

      return () => {
        socket.off('alert:critical');
      };
    }
  }, [socket]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/dashboard/alerts', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/dismiss`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert._id !== alertId));
      }
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getAlertBorderColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'border-l-red-500';
      case 'warning':
        return 'border-l-yellow-500';
      default:
        return 'border-l-blue-500';
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900">All Good!</h3>
        </div>
        <p className="text-gray-600">No active alerts at this time.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
        <p className="text-sm text-gray-500 mt-1">
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''} requiring attention
        </p>
      </div>
      
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert._id}
            className={`p-4 border-l-4 ${getAlertBorderColor(alert.type)} hover:bg-gray-50 transition-colors`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {alert.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {alert.message}
                  </p>
                  {alert.userId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Related to: {alert.userId.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert._id)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsWidget;