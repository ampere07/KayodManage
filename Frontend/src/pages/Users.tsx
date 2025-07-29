import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Eye, 
  AlertCircle, 
  Ban, 
  Clock, 
  Shield,
  MoreVertical,
  X,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  categories: string[];
  isVerified: boolean;
  isRestricted: boolean;
  isOnline: boolean;
  accountStatus?: 'active' | 'restricted' | 'suspended' | 'banned';
  restrictionDetails?: {
    type: 'restricted' | 'suspended' | 'banned';
    reason: string;
    restrictedAt: Date;
    suspendedUntil?: Date;
    appealAllowed: boolean;
  };
  wallet: {
    balance: number;
    currency: string;
  };
  fees: Array<{
    amount: number;
    dueDate: Date;
    isPaid: boolean;
  }>;
  createdAt: Date;
  lastLogin?: Date;
}

interface UserStats {
  totalUsers: number;
  onlineUsers: number;
  verifiedUsers: number;
  restrictedUsers: number;
}

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  user: User | null;
  actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict';
}

const ActionModal: React.FC<ActionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  user, 
  actionType 
}) => {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(7);
  
  if (!isOpen || !user) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with action:', actionType); // Debug log
    
    if (actionType === 'unrestrict') {
      onConfirm({});
    } else if (actionType === 'suspend') {
      if (!reason.trim()) {
        toast.error('Please provide a reason for suspension');
        return;
      }
      onConfirm({ reason: reason.trim(), duration });
    } else if (actionType === 'ban') {
      if (!reason.trim()) {
        toast.error('Please provide a reason for ban');
        return;
      }
      onConfirm({ reason: reason.trim() });
    } else if (actionType === 'restrict') {
      onConfirm({ restricted: true });
    }
    
    setReason('');
    setDuration(7);
    onClose();
  };
  
  const getModalTitle = () => {
    switch (actionType) {
      case 'ban': return 'Ban User';
      case 'suspend': return 'Suspend User';
      case 'restrict': return 'Restrict User';
      case 'unrestrict': return 'Remove Restrictions';
      default: return '';
    }
  };
  
  const getModalDescription = () => {
    switch (actionType) {
      case 'ban': return 'This will permanently ban the user from the platform. They will not be able to access their account.';
      case 'suspend': return 'This will temporarily suspend the user for the specified duration. They will not be able to access their account during this period.';
      case 'restrict': return 'This will restrict the user\'s account access with limited functionality.';
      case 'unrestrict': return 'This will remove all restrictions from the user\'s account and restore full access.';
      default: return '';
    }
  };

  const getButtonText = () => {
    switch (actionType) {
      case 'ban': return 'Ban User';
      case 'suspend': return 'Suspend User';
      case 'restrict': return 'Restrict User';
      case 'unrestrict': return 'Remove Restrictions';
      default: return 'Confirm';
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{getModalTitle()}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            User: <span className="font-medium">{user.name}</span> ({user.email})
          </p>
          <p className="text-sm text-gray-500">{getModalDescription()}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {(actionType === 'ban' || actionType === 'suspend') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                placeholder="Provide a detailed reason for this action..."
                required
              />
            </div>
          )}
          
          {actionType === 'suspend' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (days)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>1 week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>1 month</option>
                <option value={90}>3 months</option>
              </select>
            </div>
          )}
          
          {/* Action Buttons - Made more prominent */}
          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 rounded-lg transition-colors shadow-lg font-semibold"
            >
              {getButtonText()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Users: React.FC = () => {
  // Local state for all data
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict';
  }>({ isOpen: false, actionType: 'restrict' });
  
  // API functions
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setUserStats(data.stats || null);
      } else {
        console.error('Failed to fetch users:', response.status);
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Filter users based on search and status
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'verified' && user.isVerified) ||
      (statusFilter === 'online' && user.isOnline) ||
      (statusFilter === 'restricted' && isUserRestricted(user));
    
    return matchesSearch && matchesStatus;
  });

  const handleUserAction = async (actionType: string, data: any = {}) => {
    if (!selectedUser) return;
    
    console.log('Handling user action:', actionType, 'for user:', selectedUser._id); // Debug log
    
    try {
      let endpoint = '';
      let method = 'PATCH';
      let body = {};
      
      switch (actionType) {
        case 'ban':
          endpoint = `/api/users/${selectedUser._id}/ban`;
          body = { reason: data.reason };
          break;
        case 'suspend':
          endpoint = `/api/users/${selectedUser._id}/suspend`;
          body = { reason: data.reason, duration: data.duration };
          break;
        case 'restrict':
          endpoint = `/api/users/${selectedUser._id}/restrict`;
          body = { restricted: true };
          break;
        case 'unrestrict':
          endpoint = `/api/users/${selectedUser._id}/unrestrict`;
          break;
        default:
          console.error('Unknown action type:', actionType);
          return;
      }
      
      console.log('Making request to:', endpoint); // Debug log
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      console.log('Response status:', response.status); // Debug log

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(prev => prev.map(user => 
          user._id === selectedUser._id ? updatedUser : user
        ));
        toast.success(`User ${actionType === 'unrestrict' ? 'unrestricted' : actionType + 'ned'} successfully`);
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText); // Debug log
        toast.error(`Failed to ${actionType} user - Server returned ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to ${actionType} user:`, error);
      toast.error(`Failed to ${actionType} user`);
    }
  };

  const toggleUserVerification = async (userId: string, isVerified: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verified: !isVerified })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(prev => prev.map(user => 
          user._id === userId ? updatedUser : user
        ));
        toast.success(`User ${!isVerified ? 'verified' : 'unverified'} successfully`);
      }
    } catch (error) {
      console.error('Failed to update user verification:', error);
      toast.error('Failed to update user verification');
    }
  };

  const openActionModal = (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict') => {
    console.log('Opening modal for action:', actionType, 'user:', user.name); // Debug log
    setSelectedUser(user);
    setActionModal({ isOpen: true, actionType });
  };

  const closeActionModal = () => {
    setActionModal({ isOpen: false, actionType: 'restrict' });
    setSelectedUser(null);
  };

  // Helper function to determine if user is restricted (includes backward compatibility)
  const isUserRestricted = (user: User) => {
    if (user.accountStatus) {
      return user.accountStatus !== 'active';
    }
    // Fallback to legacy field
    return user.isRestricted;
  };

  // Helper function to get user's effective status
  const getUserStatus = (user: User) => {
    if (user.accountStatus) {
      return user.accountStatus;
    }
    // Fallback logic for users without accountStatus
    return user.isRestricted ? 'restricted' : 'active';
  };

  const getStatusBadge = (user: User) => {
    const status = getUserStatus(user);
    
    if (status === 'banned') {
      return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Banned</span>;
    }
    if (status === 'suspended') {
      const isExpired = user.restrictionDetails?.suspendedUntil && new Date(user.restrictionDetails.suspendedUntil) <= new Date();
      return (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          isExpired ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {isExpired ? 'Suspension Expired' : 'Suspended'}
        </span>
      );
    }
    if (status === 'restricted') {
      return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Restricted</span>;
    }
    return null;
  };

  const getOverdueFees = (fees: User['fees']) => {
    if (!fees || !Array.isArray(fees)) return [];
    return fees.filter(fee => !fee.isPaid && new Date(fee.dueDate) < new Date());
  };

  const formatCurrency = (amount: number, currency: string = 'PHP') => {
    if (currency === 'PHP') {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        currencyDisplay: 'symbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount).replace('PHP', '₱');
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              <div className="flex items-center space-x-2">
                <WifiOff className="h-4 w-4 text-gray-500" />
                <span className="text-xs text-gray-600">API Mode</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {userStats ? `${userStats.totalUsers} total users` : `${filteredUsers.length} users`}
              {userStats && (
                <span className="ml-2">
                  • {userStats.onlineUsers} online • {userStats.verifiedUsers} verified
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Users</option>
            <option value="verified">Verified</option>
            <option value="restricted">Restricted</option>
            <option value="online">Online</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">
              {searchTerm || statusFilter !== 'all' ? (
                <p>No users match your filters</p>
              ) : (
                <p>No users found</p>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wallet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const overdueFees = getOverdueFees(user.fees);
                  const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
                  const userStatus = getUserStatus(user);
                  const isRestricted = isUserRestricted(user);
                  
                  return (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center space-x-2">
                              <div className="text-sm font-medium text-gray-900">
                                {user.name}
                              </div>
                              {user.isOnline && (
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            <div className="text-xs text-gray-400">{user.location}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.isVerified 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {user.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                          {getStatusBadge(user)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(user.wallet.balance, user.wallet.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {overdueFees.length > 0 ? (
                          <div className="flex items-center space-x-1 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatCurrency(totalOverdue, 'PHP')} overdue
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No overdue</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Verification Toggle */}
                          <button
                            onClick={() => toggleUserVerification(user._id, user.isVerified)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.isVerified
                                ? 'text-yellow-600 hover:bg-yellow-100'
                                : 'text-green-600 hover:bg-green-100'
                            }`}
                            title={user.isVerified ? 'Unverify user' : 'Verify user'}
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                          
                          {/* Restriction Actions */}
                          {!isRestricted ? (
                            <>
                              <button
                                onClick={() => openActionModal(user, 'restrict')}
                                className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                                title="Restrict user"
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(user, 'suspend')}
                                className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors"
                                title="Suspend user"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(user, 'ban')}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Ban user"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openActionModal(user, 'unrestrict')}
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                              title="Remove restrictions"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          
                          {/* View Details */}
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      <ActionModal
        isOpen={actionModal.isOpen}
        onClose={closeActionModal}
        onConfirm={(data) => handleUserAction(actionModal.actionType, data)}
        user={selectedUser}
        actionType={actionModal.actionType}
      />
    </div>
  );
};

export default Users;
