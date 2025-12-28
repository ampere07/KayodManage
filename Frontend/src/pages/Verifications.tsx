import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Shield, 
  User, 
  CheckCircle, 
  XCircle, 
  Eye,
  Image,
  Calendar,
  AlertCircle,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { isNetworkError } from '../utils/apiClient';
import { verificationsService } from '../services';
import { VerificationDetailsModal } from '../components/Modals';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import type { Verification, UserInfo } from '../types';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs = {
    approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle },
    under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle }
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3 mr-1" />
      {displayStatus}
    </span>
  );
};

const UserAvatar: React.FC<{ user: UserInfo; size?: 'sm' | 'md' | 'lg' }> = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-2xl'
  };

  if (user.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={user.name}
        className={`${sizeClasses[size].split(' ').slice(0, 2).join(' ')} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-300 flex items-center justify-center`}>
      <span className="font-semibold text-gray-700">
        {getInitials(user.name)}
      </span>
    </div>
  );
};

const Verifications: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchVerifications();
    }
  }, [isAuthenticated, authLoading]);

  // Handle id/verificationId from URL params
  useEffect(() => {
    const id = searchParams.get('id');
    const verificationId = searchParams.get('verificationId');
    const targetId = id || verificationId;
    
    if (targetId && verifications.length > 0) {
      // Find verification by ID or by userId
      const verification = verifications.find(v => 
        v._id === targetId || v.userId?._id === targetId
      );
      
      if (verification) {
        // Set the highlighted user
        setHighlightedUserId(verification.userId?._id || null);
        
        // Open the modal automatically
        setSelectedVerification(verification);
        setModalOpen(true);
        
        // Scroll to the highlighted row after a short delay
        setTimeout(() => {
          highlightedRowRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 300);
        
        // Clear the URL parameter after processing
        searchParams.delete('id');
        searchParams.delete('verificationId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [verifications, searchParams, setSearchParams]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      
      if (!isAuthenticated) {
        return;
      }

      const data = await verificationsService.getAllVerifications();
      
      if (data.success) {
        setVerifications(data.data || []);
      }
    } catch (error: any) {
      const isNetworkErrorDetected = isNetworkError(error);
      
      if (isNetworkErrorDetected) {
        toast.error('Cannot connect to server');
      } else {
        toast.error('Failed to load verifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (
    verificationId: string, 
    status: string, 
    notes?: string, 
    reason?: string
  ): Promise<void> => {
    try {
      if (!isAuthenticated) {
        throw new Error('Please login to perform this action');
      }

      const response = await verificationsService.updateVerificationStatus(verificationId, {
        status: status as any,
        adminNotes: notes,
        rejectionReason: reason
      });

      if (response.success) {
        await fetchVerifications();
        setModalOpen(false);
      } else {
        throw new Error(response.message || 'Failed to update status');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to update status');
    }
  };

  const openModal = (verification: Verification) => {
    setSelectedVerification(verification);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedVerification(null), 300);
    // Keep the highlight for a few seconds after closing modal
    setTimeout(() => {
      setHighlightedUserId(null);
    }, 3000);
  };

  const userVerifications = useMemo(() => {
    const grouped = verifications.reduce((acc, verification) => {
      if (!verification.userId) return acc;
      
      const userId = verification.userId._id;
      if (!acc[userId]) {
        acc[userId] = {
          user: verification.userId,
          verifications: []
        };
      }
      acc[userId].verifications.push(verification);
      return acc;
    }, {} as Record<string, { user: UserInfo; verifications: Verification[] }>);

    return Object.values(grouped);
  }, [verifications]);

  const filteredUsers = useMemo(() => {
    return userVerifications.filter(({ user, verifications }) => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        verifications.some(v => {
          if (statusFilter === 'under_review') {
            return v.status === 'under_review' || v.status === 'pending';
          }
          return v.status === statusFilter;
        });
      
      return matchesSearch && matchesStatus;
    });
  }, [userVerifications, searchTerm, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, statusFilter]);

  // Paginate filtered users
  const paginatedUsers = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, pagination.page, pagination.limit]);

  const totalPages = Math.ceil(filteredUsers.length / pagination.limit);

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 md:left-64 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading verifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">User Verifications</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">{filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Total Users</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{userVerifications.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Pending Review</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {userVerifications.filter(({ verifications }) => 
                verifications.some(v => v.status === 'pending' || v.status === 'under_review')
              ).length}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Approved</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {userVerifications.filter(({ verifications }) => 
                verifications.some(v => v.status === 'approved')
              ).length}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Rejected</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {userVerifications.filter(({ verifications }) => 
                verifications.some(v => v.status === 'rejected')
              ).length}
            </p>
          </div>
        </div>

        {/* Filters */}
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
          
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('under_review')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === 'under_review'
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === 'approved'
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === 'rejected'
                  ? 'bg-red-50 text-red-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Submissions</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Documents</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedUsers.map(({ user, verifications }) => {
                      const latestVerification = verifications[0];
                      const totalDocuments = verifications.reduce((sum, v) => 
                        sum + 1 + 1 + v.credentials.length, 0
                      );
                      const isHighlighted = highlightedUserId === user._id;

                      return (
                        <tr 
                          key={user._id} 
                          ref={isHighlighted ? highlightedRowRef : null}
                          onClick={() => openModal(latestVerification)}
                          className={`hover:bg-gray-50 transition-all duration-300 cursor-pointer ${
                            isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset shadow-lg' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <UserAvatar user={user} size="md" />
                              <div className="ml-3">
                                <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <UserTypeBadge userType={user.userType} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <StatusBadge status={latestVerification.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-gray-900">{verifications.length}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center text-sm text-gray-600">
                              <Image className="w-4 h-4 mr-1" />
                              {totalDocuments}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {new Date(latestVerification.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(latestVerification.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {paginatedUsers.map(({ user, verifications }) => {
                  const latestVerification = verifications[0];
                  const totalDocuments = verifications.reduce((sum, v) => 
                    sum + 1 + 1 + v.credentials.length, 0
                  );
                  const isHighlighted = highlightedUserId === user._id;

                  return (
                    <div 
                      key={user._id} 
                      onClick={() => openModal(latestVerification)}
                      className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all duration-300 ${
                        isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400 shadow-lg' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <UserAvatar user={user} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h3>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        <UserTypeBadge userType={user.userType} />
                        <StatusBadge status={latestVerification.status} />
                      </div>

                      <div className="space-y-2 mb-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Submissions:</span>
                          <span className="font-medium">{verifications.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Documents:</span>
                          <span className="font-medium">{totalDocuments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Submitted:</span>
                          <span>{new Date(latestVerification.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
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
                          {Math.min(pagination.page * pagination.limit, filteredUsers.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{filteredUsers.length}</span> results
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
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                        disabled={pagination.page === totalPages}
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

      {/* Modal */}
      <VerificationDetailsModal
        isOpen={modalOpen}
        onClose={closeModal}
        verification={selectedVerification}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
};

export default Verifications;
