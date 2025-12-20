import React, { useState, useEffect } from 'react';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};
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
  User as UserIcon,
  Phone,
  Tag,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';

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

interface VerificationDetails {
  verifiedBy?: {
    _id: string;
    name: string;
  };
  verifiedAt?: Date;
}

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onVerify: (userId: string, isVerified: boolean) => void;
  onAction: (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict') => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  onVerify,
  onAction
}) => {
  const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<'ban' | 'suspend' | 'restrict' | 'unrestrict' | null>(null);

  useEffect(() => {
    if (isOpen && user?.isVerified) {
      fetchVerificationDetails();
    }
    if (!isOpen) {
      setConfirmingAction(null);
    }
  }, [isOpen, user]);

  const fetchVerificationDetails = async () => {
    if (!user?._id) return;
    
    setLoadingVerification(true);
    try {
      const response = await fetch(`/api/verifications/${user._id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.reviewedBy && data.reviewedAt) {
          setVerificationDetails({
            verifiedBy: data.reviewedBy,
            verifiedAt: data.reviewedAt
          });
        }
      }
    } catch (error) {
      console.error('Error fetching verification details:', error);
    } finally {
      setLoadingVerification(false);
    }
  };

  const handleActionClick = (actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict') => {
    setConfirmingAction(actionType);
  };

  const handleConfirmYes = () => {
    if (confirmingAction) {
      onAction(user!, confirmingAction);
      setConfirmingAction(null);
    }
  };

  const handleConfirmNo = () => {
    setConfirmingAction(null);
  };

  const getActionText = () => {
    switch (confirmingAction) {
      case 'ban': return 'ban this user';
      case 'suspend': return 'suspend this user';
      case 'restrict': return 'restrict this user';
      case 'unrestrict': return 'remove restrictions from this user';
      default: return '';
    }
  };

  if (!isOpen || !user) return null;

  const isRestricted = user.accountStatus ? user.accountStatus !== 'active' : user.isRestricted;

  const formatKYDNumber = (id: string) => {
    return `KYD: ${id}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('KYD copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy KYD');
    });
  };

  const parseFullName = (fullName: string) => {
    const nameParts = fullName.trim().split(' ');
    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: nameParts[0] };
    }
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  };

  const { firstName, lastName } = parseFullName(user.name);

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed right-0 top-0 h-full w-full md:w-[550px] bg-gray-50 z-50 shadow-2xl overflow-y-auto flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 flex-1 flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 mb-6">User Information</h2>
          <div className="border-t border-gray-300 mb-6 -mx-6" />

          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-2xl font-semibold text-gray-700">
                      {getInitials(user.name)}
                    </span>
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{user.name}</h3>
                <button
                  onClick={() => copyToClipboard(user._id)}
                  className="text-sm text-gray-600 hover:text-blue-600 cursor-pointer transition-colors"
                  title="Click to copy"
                >
                  {formatKYDNumber(user._id)}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <VerificationStatusBadge isVerified={user.isVerified} />
              {user.userType && <UserTypeBadge userType={user.userType} />}
            </div>
          </div>

          <div className="border-t border-gray-300 mb-6 -mx-6" />

          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Information</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                <p className="text-base text-gray-900"><span className="text-gray-600">First Name:</span> {firstName}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Age:</span> 22</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Last Name:</span> {lastName}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Birthdate:</span> December 7, 2003</p>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact</h3>
              <div className="space-y-2.5">
                <p className="text-base text-gray-900"><span className="text-gray-600">Email Address:</span> {user.email}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Contact Number:</span> {user.phone || 'N/A'}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Location:</span> {user.location || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div className="flex-1 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Other Information</h3>
            <div className="space-y-2.5">
              <p className="text-base text-gray-900"><span className="text-gray-600">Verification Status:</span> {user.isVerified ? 'Verified' : 'Not Verified'}</p>
              {user.isVerified && (
                <>
                  <p className="text-base text-gray-900">
                    <span className="text-gray-600">Verified By:</span> {loadingVerification ? (
                      <span>Loading...</span>
                    ) : verificationDetails?.verifiedBy ? (
                      <span>
                        {verificationDetails.verifiedBy.name} ({formatKYDNumber(verificationDetails.verifiedBy._id)})
                      </span>
                    ) : (
                      <span>N/A</span>
                    )}
                  </p>
                  <p className="text-base text-gray-900">
                    <span className="text-gray-600">Verification Date:</span> {loadingVerification ? (
                      <span>Loading...</span>
                    ) : verificationDetails?.verifiedAt ? (
                      <span>
                        {new Date(verificationDetails.verifiedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    ) : (
                      <span>N/A</span>
                    )}
                  </p>
                </>
              )}
            </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 justify-center mt-auto pt-6 -mx-6 px-6">
            {confirmingAction ? (
              <>
                <p className="text-sm text-gray-700 mb-2">Are you sure you want to {getActionText()}?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmNo}
                    className="flex-1 px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    No
                  </button>
                  <button
                    onClick={handleConfirmYes}
                    className="flex-1 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Yes
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
            {!isRestricted ? (
                <>
                <button
                  onClick={() => handleActionClick('restrict')}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  Restrict
                </button>
                <button
                  onClick={() => handleActionClick('suspend')}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  Suspend
                </button>
                <button
                  onClick={() => handleActionClick('ban')}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                >
                  <Ban className="h-4 w-4" />
                  Ban
                </button>
                </>
            ) : (
              <button
                onClick={() => handleActionClick('unrestrict')}
                className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
              >
                <UserX className="h-4 w-4" />
                Remove Restrictions
              </button>
            )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false });
  
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
        setSelectedUser(updatedUser);
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
        setSelectedUser(updatedUser);
        toast.success(`User ${!isVerified ? 'verified' : 'unverified'} successfully`);
      }
    } catch (error) {
      toast.error('Failed to update verification');
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

  const handleAction = async (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict') => {
    closeDetailsModal();
    setSelectedUser(user);
    await handleUserAction(actionType, {});
  };

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {userStats ? userStats.totalUsers : filteredUsers.length} total users
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

        <div className="flex flex-col md:flex-row gap-3">
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
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
          >
            <option value="all">All Users</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
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
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Wallet
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => {
                      const overdueFees = getOverdueFees(user.fees);
                      const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
                      const isRestricted = isUserRestricted(user);
                      
                      return (
                        <tr 
                          key={user._id} 
                          onClick={() => openDetailsModal(user)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
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
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                                <div className="text-xs text-gray-500">{user.location || 'No location'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-gray-900 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                {user.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
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
                                {user.userType === 'provider' ? 'Provider' : 'Client'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(user.wallet.balance, user.wallet.currency)}
                            </div>
                            {overdueFees.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                <AlertCircle className="h-3 w-3" />
                                <span>{formatCurrency(totalOverdue, 'PHP')}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!isRestricted ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetailsModal(user);
                                    }}
                                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                    title="Restrict"
                                  >
                                    <Shield className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetailsModal(user);
                                    }}
                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                    title="Suspend"
                                  >
                                    <Clock className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetailsModal(user);
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Ban"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetailsModal(user);
                                  }}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Remove restrictions"
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetailsModal(user);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
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

              <div className="md:hidden px-4 py-4 space-y-3">
                {filteredUsers.map((user) => {
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
                              {user.userType === 'provider' ? 'Provider' : 'Client'}
                            </span>
                          )}
                          {isRestricted && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              Restricted
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 mb-3">
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

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {!isRestricted ? (
                              <>
                                <button
                                  onClick={() => openDetailsModal(user)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Restrict"
                                >
                                  <Shield className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDetailsModal(user)}
                                  className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                  title="Suspend"
                                >
                                  <Clock className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDetailsModal(user)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Ban"
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => openDetailsModal(user)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Remove restrictions"
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => openDetailsModal(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
