import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserCheck, 
  UserX, 
  Eye, 
  AlertCircle, 
  Ban, 
  Clock, 
  Shield,
  X,
  WifiOff,
  RefreshCw,
  Mail,
  MapPin,
  Wallet as WalletIcon,
  Calendar,
  MoreHorizontal,
  Briefcase,
  User as UserIcon
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
  userType?: 'client' | 'provider';
  profileImage?: string;
  profileImagePublicId?: string;
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
      case 'ban': return 'This will permanently ban the user from the platform.';
      case 'suspend': return 'This will temporarily suspend the user for the specified duration.';
      case 'restrict': return 'This will restrict the user\'s account access.';
      case 'unrestrict': return 'This will remove all restrictions and restore full access.';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">{getModalTitle()}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <div className="p-3 bg-gray-50 rounded-lg mb-3">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <p className="text-sm text-gray-600">{getModalDescription()}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {(actionType === 'ban' || actionType === 'suspend') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Provide a reason..."
                required
              />
            </div>
          )}
          
          {actionType === 'suspend' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>1 week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>1 month</option>
              </select>
            </div>
          )}
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg"
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
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', { credentials: 'include' });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setUserStats(data.stats || null);
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      toast.error('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);
  
  const isUserRestricted = (user: User) => {
    if (user.accountStatus) return user.accountStatus !== 'active';
    return user.isRestricted;
  };

  const getUserStatus = (user: User) => {
    if (user.accountStatus) return user.accountStatus;
    return user.isRestricted ? 'restricted' : 'active';
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
        minimumFractionDigits: 0,
      }).format(amount).replace('PHP', '₱');
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };
  
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'suspended' && user.accountStatus === 'suspended') ||
      (statusFilter === 'banned' && user.accountStatus === 'banned');
    
    return matchesSearch && matchesStatus;
  });

  const handleUserAction = async (actionType: string, data: any = {}) => {
    if (!selectedUser) return;
    
    try {
      let endpoint = '';
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
          return;
      }
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(prev => prev.map(user => 
          user._id === selectedUser._id ? updatedUser : user
        ));
        toast.success(`User ${actionType === 'unrestrict' ? 'unrestricted' : actionType + 'ned'} successfully`);
      } else {
        toast.error(`Failed to ${actionType} user`);
      }
    } catch (error) {
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
      toast.error('Failed to update verification');
    }
  };

  const openActionModal = (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict') => {
    setSelectedUser(user);
    setActionModal({ isOpen: true, actionType });
  };

  const closeActionModal = () => {
    setActionModal({ isOpen: false, actionType: 'restrict' });
    setSelectedUser(null);
  };

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-1">
              {userStats ? `${userStats.totalUsers} users` : `${filteredUsers.length} users`}
              {userStats && ` • ${userStats.onlineUsers} online • ${userStats.verifiedUsers} verified`}
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-gray-600">Restrict</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-gray-600">Suspend</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ban className="h-4 w-4 text-red-600" />
              <span className="font-medium text-gray-600">Ban</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
          <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          statusFilter === 'all'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          >
          All Users ({userStats ? userStats.totalUsers : filteredUsers.length})
          </button>
          <button
          onClick={() => setStatusFilter('suspended')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          statusFilter === 'suspended'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          >
          Suspended ({users.filter(u => u.accountStatus === 'suspended').length})
          </button>
          <button
          onClick={() => setStatusFilter('banned')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          statusFilter === 'banned'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          >
          Banned ({users.filter(u => u.accountStatus === 'banned').length})
          </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading users...</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="text-gray-400 mb-4">
              <Search className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-600 font-medium">No users found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => {
              const overdueFees = getOverdueFees(user.fees);
              const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
              const isRestricted = isUserRestricted(user);
              
              return (
                <div
                  key={user._id}
                  className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-100 hover:border-blue-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        {user.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={user.name}
                            className="w-12 h-12 rounded-full object-cover shadow-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-lg">
                            <span className="text-lg font-bold text-gray-700">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {user.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{user.name}</h3>
                        <p className="text-xs text-gray-500 truncate flex items-center space-x-1">
                          <Mail className="h-3 w-3" />
                          <span>{user.email}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.isVerified 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {user.isVerified ? '✓ Verified' : 'Unverified'}
                    </span>
                    {user.userType && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.userType === 'provider'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {user.userType === 'provider' ? (
                          <Briefcase className="h-3 w-3" />
                        ) : (
                          <UserIcon className="h-3 w-3" />
                        )}
                        {user.userType === 'provider' ? 'Service Provider' : 'Client'}
                      </span>
                    )}
                    {isRestricted && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        Restricted
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center space-x-1.5">
                        <WalletIcon className="h-4 w-4" />
                        <span>Balance</span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(user.wallet.balance, user.wallet.currency)}
                      </span>
                    </div>
                    {overdueFees.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-500 flex items-center space-x-1.5">
                          <AlertCircle className="h-4 w-4" />
                          <span>Overdue</span>
                        </span>
                        <span className="font-semibold text-red-600">
                          {formatCurrency(totalOverdue, 'PHP')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center space-x-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>Joined</span>
                      </span>
                      <span className="text-gray-700">
                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      {!isRestricted ? (
                        <>
                          <button
                            onClick={() => openActionModal(user, 'restrict')}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Restrict"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openActionModal(user, 'suspend')}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Suspend"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openActionModal(user, 'ban')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Ban"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openActionModal(user, 'unrestrict')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Remove restrictions"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <button
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
