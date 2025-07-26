import React, { useState, useEffect } from 'react';
import { Activity, User, Briefcase, CreditCard, Calendar, Filter } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useSocket } from '../hooks/useSocket';

interface ActivityItem {
  _id: string;
  type: 'user_registered' | 'job_posted' | 'job_applied' | 'payment_completed' | 'fee_paid' | 'user_login';
  description: string;
  timestamp: Date;
  userId?: {
    name: string;
    email: string;
  };
  jobId?: {
    title: string;
  };
  metadata?: any;
}

const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const socket = useSocket('admin');

  useEffect(() => {
    fetchActivities();
  }, [typeFilter]);

  useEffect(() => {
    if (socket) {
      socket.on('activity:new', (activity: ActivityItem) => {
        setActivities(prev => [activity, ...prev]);
      });

      return () => {
        socket.off('activity:new');
      };
    }
  }, [socket]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/activity', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registered':
      case 'user_login':
        return <User className="h-5 w-5" />;
      case 'job_posted':
      case 'job_applied':
        return <Briefcase className="h-5 w-5" />;
      case 'payment_completed':
      case 'fee_paid':
        return <CreditCard className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user_registered':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'user_login':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'job_posted':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'job_applied':
        return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      case 'payment_completed':
        return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'fee_paid':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const filteredActivities = typeFilter === 'all' 
    ? activities 
    : activities.filter(activity => activity.type === typeFilter);

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'user_registered', label: 'User Registrations' },
    { value: 'user_login', label: 'User Logins' },
    { value: 'job_posted', label: 'Job Postings' },
    { value: 'job_applied', label: 'Job Applications' },
    { value: 'payment_completed', label: 'Payments' },
    { value: 'fee_paid', label: 'Fee Payments' }
  ];

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Activity Feed</h2>
            <p className="text-sm text-gray-500 mt-1">
              Real-time platform activity and events
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {activityTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading activity feed...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Found</h3>
            <p className="text-gray-500">No activities match your current filter.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {filteredActivities.map((activity, index) => (
                  <li key={activity._id}>
                    <div className="relative pb-8">
                      {index !== filteredActivities.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex space-x-3">
                        <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${getActivityColor(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">
                                {activity.description}
                              </p>
                              {activity.userId && (
                                <p className="text-xs text-gray-500 mt-1">
                                  by {activity.userId.name} ({activity.userId.email})
                                </p>
                              )}
                              {activity.jobId && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Related to job: {activity.jobId.title}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <time className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                              </time>
                              <div className="text-xs text-gray-400 mt-1">
                                {format(new Date(activity.timestamp), 'MMM d, yyyy HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100">
              <User className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">User Activities</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activities.filter(a => a.type.includes('user')).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-100">
              <Briefcase className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Job Activities</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activities.filter(a => a.type.includes('job')).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-emerald-100">
              <CreditCard className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Payment Activities</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activities.filter(a => a.type.includes('payment') || a.type.includes('fee')).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-100">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Activities</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activities.filter(a => {
                  const today = new Date();
                  const activityDate = new Date(a.timestamp);
                  return activityDate.toDateString() === today.toDateString();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;