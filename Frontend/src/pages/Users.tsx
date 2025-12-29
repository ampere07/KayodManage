import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Search, 
  UserCheck, 
  UserX, 
  Eye, 
  AlertCircle, 
  Ban, 
  Clock, 
  Shield,
  Mail,
  MapPin,
  Wallet as WalletIcon,
  Calendar,
  Briefcase,
  User as UserIcon,
  Phone,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { usersService } from '../services';
import { UserDetailsModal } from '../components/Modals';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';
import type { User, UserStats } from '../types';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const Users: React.FC = () => {
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'suspended' | 'banned' | 'restricted'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false });
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    suspended: 0,
    banned: 0,
    restricted: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  const getUserType = () => {
    const path = location.pathname;
    if (path === '/users/customers') return 'customers';
    if (path === '/users/providers') return 'providers';
    if (path === '/users/flagged') return 'flagged';
    return 'all';
  };
  
  const getPageTitle = () => {
    const type = getUserType();
    if (type === 'customers') return 'Customers';
    if (type === 'providers') return 'Service Providers';
    if (type === 'flagged') return 'Flagged & Suspended Users';
    return 'All Users';
  };
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        ...(searchTerm && { search: searchTerm })
      };

      // Handle sidebar navigation (user type)
      const userType = getUserType();
      if (userType === 'customers') params.userType = 'client';
      if (userType === 'providers') params.userType = 'provider';
      if (userType === 'flagged') params.restricted = 'true';

      // Handle tab filtering (status)
      if (statusFilter === 'suspended') params.status = 'suspended';
      if (statusFilter === 'banned') params.status = 'banned';
      if (statusFilter === 'restricted') params.status = 'restricted';

      const data = await usersService.getUsers(params);
      
      setUsers(data.users || []);
      setUserStats(data.stats || null);
      setPagination(prev => ({ 
        ...prev, 
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 1
      }));
    } catch (error) {
      toast.error('Error loading users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusCounts = async () => {
    try {
      const userType = getUserType();
      const baseParams: any = {};
      
      if (userType === 'customers') baseParams.userType = 'client';
      if (userType === 'providers') baseParams.userType = 'provider';
      if (userType === 'flagged') baseParams.restricted = 'true';

      // Fetch counts for each status
      const [allData, suspendedData, bannedData, restrictedData] = await Promise.all([
        usersService.getUsers({ ...baseParams, limit: 1, page: 1 }),
        usersService.getUsers({ ...baseParams, status: 'suspended', limit: 1, page: 1 }),
        usersService.getUsers({ ...baseParams, status: 'banned', limit: 1, page: 1 }),
        usersService.getUsers({ ...baseParams, status: 'restricted', limit: 1, page: 1 })
      ]);

      setStatusCounts({
        all: allData.pagination?.total || 0,
        suspended: suspendedData.pagination?.total || 0,
        banned: bannedData.pagination?.total || 0,
        restricted: restrictedData.pagination?.total || 0
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setStatusFilter('all'); // Reset status filter when changing user type
    fetchStatusCounts(); // Fetch counts when user type changes
  }, [location.pathname]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, location.pathname, searchTerm, statusFilter]);
  
  const isUserRestricted = (user: User) => {
    if (user.accountStatus) return user.accountStatus !== 'active';
    return user.isRestricted;
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

  const handleUserAction = async (actionType: string, duration?: number) => {
    if (!selectedUser) return;
    
    console.log('handleUserAction called:', { actionType, duration, userId: selectedUser._id });
    
    try {
      let updatedUser: User;
      
      switch (actionType) {
        case 'ban':
          console.log('Calling banUser with duration:', duration);
          updatedUser = await usersService.banUser(selectedUser._id, 'Banned by admin', duration);
          break;
        case 'suspend':
          console.log('Calling suspendUser with duration:', duration);
          updatedUser = await usersService.suspendUser(selectedUser._id, 'Suspended by admin', duration || 7);
          break;
        case 'restrict':
          console.log('Calling restrictUser with duration:', duration);
          updatedUser = await usersService.restrictUser(selectedUser._id, duration);
          break;
        case 'unrestrict':
          updatedUser = await usersService.unrestrictUser(selectedUser._id);
          break;
        default:
          return;
      }

      console.log('Updated user received:', updatedUser);

      setUsers(prev => prev.map(user => 
        user._id === selectedUser._id ? updatedUser : user
      ));
      setSelectedUser(updatedUser);
      toast.success(`User ${actionType === 'unrestrict' ? 'unrestricted' : actionType + 'ned'} successfully`);
    } catch (error) {
      toast.error(`Failed to ${actionType} user`);
      console.error(`Error ${actionType}ing user:`, error);
    }
  };

  const toggleUserVerification = async (userId: string, isVerified: boolean) => {
    try {
      const updatedUser = await usersService.verifyUser(userId, !isVerified);
      
      setUsers(prev => prev.map(user => 
        user._id === userId ? updatedUser : user
      ));
      setSelectedUser(updatedUser);
      toast.success(`User ${!isVerified ? 'verified' : 'unverified'} successfully`);
    } catch (error) {
      toast.error('Failed to update verification');
      console.error('Error updating verification:', error);
    }
  };

  const openDetailsModal = (user: User) => {
    setSelectedUser(user);
    setDetailsModal({ isOpen: true });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ isOpen: false });
    setTimeout(() => setSelectedUser(null), 300);
  };

  const handleAction = async (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict', duration?: number) => {
    setSelectedUser(user);
    await handleUserAction(actionType, duration);
  };

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {pagination.total} {pagination.total === 1 ? 'user' : 'users'}
            </p>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-xs">
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
            <div className="flex items-center gap-1.5">
              <UserX className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-600">Remove Restriction</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-gray-600">View</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          {getUserType() === 'all' && (
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
              {[
                { key: 'all', label: 'All', count: statusCounts.all },
                { key: 'suspended', label: 'Suspended', count: statusCounts.suspended },
                { key: 'banned', label: 'Banned', count: statusCounts.banned },
                { key: 'restricted', label: 'Restricted', count: statusCounts.restricted }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as typeof statusFilter)}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading users...</p>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                        User
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[180px]">
                        Contact
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                        Type
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[130px]">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                        Wallet
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => {
                      const overdueFees = getOverdueFees(user.fees);
                      const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
                      const isRestricted = isUserRestricted(user);
                      
                      return (
                        <tr 
                          key={user._id} 
                          onClick={() => openDetailsModal(user)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="relative flex-shrink-0 mr-3">
                                {user.profileImage ? (
                                  <img
                                    src={user.profileImage}
                                    alt={user.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-gray-700">
                                      {getInitials(user.name)}
                                    </span>
                                  </div>
                                )}
                                {user.isOnline && (
                                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
                                <div className="text-xs text-gray-500 truncate">{user.location || 'No location'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="text-xs text-gray-900 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[150px] lg:max-w-[200px]">{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{user.phone}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4 text-center">
                            {user.userType && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                user.userType === 'provider'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {user.userType === 'provider' ? (
                                  <Briefcase className="h-3 w-3" />
                                ) : (
                                  <UserIcon className="h-3 w-3" />
                                )}
                                {user.userType === 'provider' ? 'Provider' : 'Customer'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                user.isVerified 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {user.isVerified ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Unverified
                                  </>
                                )}
                              </span>
                              {isRestricted && (
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                                  Restricted
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(user.wallet.balance, user.wallet.currency)}
                            </div>
                            {overdueFees.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                <span>{formatCurrency(totalOverdue, 'PHP')}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden px-4 py-4 space-y-3">
                {users.map((user) => {
                  const overdueFees = getOverdueFees(user.fees);
                  const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
                  const isRestricted = isUserRestricted(user);
                  
                  return (
                    <div 
                      key={user._id} 
                      onClick={() => openDetailsModal(user)}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              {user.profileImage ? (
                                <img
                                  src={user.profileImage}
                                  alt={user.name}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-base font-semibold text-gray-700">
                                    {getInitials(user.name)}
                                  </span>
                                </div>
                              )}
                              {user.isOnline && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h3>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            user.isVerified 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {user.isVerified ? '✓ Verified' : 'Unverified'}
                          </span>
                          {user.userType && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              user.userType === 'provider'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {user.userType === 'provider' ? (
                                <Briefcase className="h-3 w-3" />
                              ) : (
                                <UserIcon className="h-3 w-3" />
                              )}
                              {user.userType === 'provider' ? 'Provider' : 'Customer'}
                            </span>
                          )}
                          {isRestricted && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              Restricted
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <WalletIcon className="h-3 w-3" />
                              Balance
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {formatCurrency(user.wallet.balance, user.wallet.currency)}
                            </span>
                          </div>
                          {overdueFees.length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Overdue
                              </span>
                              <span className="text-sm font-bold text-red-600">
                                {formatCurrency(totalOverdue, 'PHP')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pagination.pages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700 text-center md:text-left">
                        Showing{' '}
                        <span className="font-medium">
                          {((pagination.page - 1) * pagination.limit) + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, pagination.total)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{pagination.total}</span> results
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.pages}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <UserDetailsModal
        isOpen={detailsModal.isOpen}
        onClose={closeDetailsModal}
        user={selectedUser}
        onVerify={toggleUserVerification}
        onAction={handleAction}
      />
    </div>
  );
};

export default Users;
