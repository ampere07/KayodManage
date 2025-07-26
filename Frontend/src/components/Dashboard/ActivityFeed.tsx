import React, { useState, useEffect } from 'react';
import { Activity, User, Briefcase, CreditCard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../../hooks/useSocket';

interface ActivityItem {
  _id: string;
  type: string;
  description: string;
  createdAt: Date;
  userId?: {
    name: string;
    email: string;
  };
  jobId?: {
    title: string;
  };
}

const ActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const socket = useSocket('admin');

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('activity:update', (newActivities: ActivityItem[]) => {
        setActivities(newActivities);
      });

      return () => {
        socket.off('activity:update');
      };
    }
  }, [socket]);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/dashboard/activity', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registered':
      case 'user_login':
        return <User className="h-4 w-4" />;
      case 'job_posted':
      case 'job_applied':
        return <Briefcase className="h-4 w-4" />;
      case 'payment_completed':
      case 'fee_paid':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user_registered':
        return 'bg-green-100 text-green-600';
      case 'user_login':
        return 'bg-blue-100 text-blue-600';
      case 'job_posted':
        return 'bg-purple-100 text-purple-600';
      case 'job_applied':
        return 'bg-indigo-100 text-indigo-600';
      case 'payment_completed':
        return 'bg-emerald-100 text-emerald-600';
      case 'fee_paid':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <p className="text-sm text-gray-500 mt-1">Live platform activity feed</p>
      </div>
      
      <div className="p-6">
        <div className="flow-root">
          <ul className="-mb-8">
            {activities.slice(0, 8).map((activity, index) => (
              <li key={activity._id}>
                <div className="relative pb-8">
                  {index !== Math.min(activities.length - 1, 7) && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        {activities.length === 0 && (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;