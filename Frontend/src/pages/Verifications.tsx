import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  User, 
  CheckCircle, 
  XCircle, 
  Eye,
  Image,
  Calendar,
  AlertCircle,
  Search,
  RefreshCw,
  ChevronLeft,
  FileText,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient, { isNetworkError } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import ClickableImage from '../components/UI/ClickableImage';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';

interface UserInfo {
  _id: string;
  name: string;
  email: string;
  userType: string;
  profileImage?: string;
}

interface VerificationDocument {
  cloudinaryUrl: string;
  publicId: string;
  uploadedAt: string;
  originalName?: string;
  type?: string;
}

interface Verification {
  _id: string;
  userId: UserInfo;
  faceVerification: VerificationDocument;
  validId: VerificationDocument & { type: string };
  credentials: VerificationDocument[];
  status: 'approved' | 'rejected' | 'pending';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: UserInfo;
  adminNotes?: string;
  rejectionReason?: string;
  verificationAttempts: number;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs = {
    approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle }
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3 mr-1" />
      {displayStatus}
    </span>
  );
};

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
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

const UserDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  verification: Verification | null;
  onStatusUpdate: (verificationId: string, status: string, notes?: string, reason?: string) => Promise<void>;
}> = ({ isOpen, onClose, verification, onStatusUpdate }) => {
  const [activeTab, setActiveTab] = useState<'face' | 'credentials'>('face');
  const [updating, setUpdating] = useState(false);

  if (!isOpen || !verification) return null;

  const user = verification.userId;

  const handleQuickApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this verification?')) {
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(verification._id, 'approved', 'Approved by admin');
      toast.success('Verification approved successfully');
    } catch (error) {
      toast.error('Failed to approve verification');
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickReject = async () => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason || reason.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(verification._id, 'rejected', 'Rejected by admin', reason.trim());
      toast.success('Verification rejected');
    } catch (error) {
      toast.error('Failed to reject verification');
    } finally {
      setUpdating(false);
    }
  };

  const getIdTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      national_id: 'National ID',
      passport: 'Passport',
      drivers_license: "Driver's License",
      voter_id: "Voter's ID",
      other: 'Other Government ID'
    };
    return types[type] || type;
  };

  const getValidIdType = () => {
    if (Array.isArray(verification.validId)) {
      return verification.validId[0]?.type || 'ID';
    }
    return verification.validId?.type || 'ID';
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className={`fixed inset-0 md:left-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Verification Details</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden flex">
            {/* Left Column - User Information */}
            <div className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-6 flex flex-col h-full">
                {/* User Avatar and Basic Info */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <UserAvatar user={user} size="lg" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 mb-1">{user.name}</h4>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-600">KYD:</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(user._id);
                              toast.success('KYD copied to clipboard');
                            }}
                            className="text-xs text-gray-600 hover:text-blue-600 cursor-pointer transition-colors truncate"
                            title="Click to copy"
                          >
                            {user._id}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <VerificationStatusBadge isVerified={verification.status === 'approved'} size="md" />
                      <UserTypeBadge userType={user.userType} size="md" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300 mb-6 -mx-6" />

                {/* Personal Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">First Name:</span> {user.name.split(' ')[0]}
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Age:</span> N/A
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Last Name:</span> {user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0]}
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Birthdate:</span> N/A
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-300 mb-6 -mx-6" />

                {/* Contact */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact</h3>
                  <div className="space-y-2.5">
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Email Address:</span> {user.email}
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Contact Number:</span> N/A
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Location:</span> N/A
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-300 mb-6 -mx-6" />

                {/* Other Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Other Information</h3>
                  <div className="space-y-2.5">
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Verification Status:</span>{' '}
                      {verification.status === 'approved' ? 'Verified' : verification.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Verified By:</span>{' '}
                      {verification.reviewedBy ? verification.reviewedBy.name : 'N/A'}
                    </p>
                    <p className="text-base text-gray-900">
                      <span className="text-gray-600">Verification Date:</span>{' '}
                      {verification.reviewedAt ? new Date(verification.reviewedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto pt-3">
                  <div className="border-t border-gray-300 -mx-6 mb-6" />
                  {verification.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleQuickApprove}
                        disabled={updating}
                        className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="inline-block w-5 h-5 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={handleQuickReject}
                        disabled={updating}
                        className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="inline-block w-5 h-5 mr-2" />
                        Reject
                      </button>
                    </div>
                  ) : verification.status === 'approved' ? (
                    <div className="rounded-lg p-3 flex items-center justify-center gap-2.5">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-700">Verified and Approved</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right Column - Verification Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top Navigation Tabs */}
              <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-2">
                  <button
                    onClick={() => setActiveTab('face')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'face'
                        ? 'bg-gray-200 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Face Verification
                  </button>
                  <button
                    onClick={() => setActiveTab('credentials')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'credentials'
                        ? 'bg-gray-200 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Certificates/Credentials ({verification.credentials.length})
                  </button>
                </div>
              </div>

              {/* Content Area - Images */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="max-w-3xl mx-auto">
                  {activeTab === 'face' && (
                    <div className="space-y-8">
                      {/* Face Verification Images */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Face Verification</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {Array.isArray(verification.faceVerification) && verification.faceVerification.length > 0 ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Left Side</p>
                                {verification.faceVerification[0] ? (
                                  <ClickableImage
                                    src={verification.faceVerification[0].cloudinaryUrl}
                                    alt="Face Left Side"
                                    className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="face"
                                    title={`Face Verification - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                              {/* Front */}
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                {verification.faceVerification[1] ? (
                                  <ClickableImage
                                    src={verification.faceVerification[1].cloudinaryUrl}
                                    alt="Face Front"
                                    className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="face"
                                    title={`Face Verification - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                              {/* Right Side */}
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Right Side</p>
                                {verification.faceVerification[2] ? (
                                  <ClickableImage
                                    src={verification.faceVerification[2].cloudinaryUrl}
                                    alt="Face Right Side"
                                    className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="face"
                                    title={`Face Verification - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : verification.faceVerification && !Array.isArray(verification.faceVerification) ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Left Side</p>
                                <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                  <p className="text-gray-400 text-sm">No image</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                <ClickableImage
                                  src={verification.faceVerification.cloudinaryUrl}
                                  alt="Face Verification"
                                  className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                  imageType="face"
                                  title={`Face Verification - ${user.name}`}
                                />
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Right Side</p>
                                <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                  <p className="text-gray-400 text-sm">No image</p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-center py-12 text-gray-500 col-span-3">No face verification uploaded</p>
                          )}
                        </div>
                      </div>

                      {/* Identification Card */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Identification Card</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {Array.isArray(verification.validId) && verification.validId.length > 0 ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                {verification.validId[0] ? (
                                  <ClickableImage
                                    src={verification.validId[0].cloudinaryUrl}
                                    alt="ID Front"
                                    className="w-full h-64 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="id"
                                    title={`Valid ID - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                              {/* Back */}
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Back</p>
                                {verification.validId[1] ? (
                                  <ClickableImage
                                    src={verification.validId[1].cloudinaryUrl}
                                    alt="ID Back"
                                    className="w-full h-64 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="id"
                                    title={`Valid ID - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : verification.validId && !Array.isArray(verification.validId) ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                <ClickableImage
                                  src={verification.validId.cloudinaryUrl}
                                  alt="Valid ID"
                                  className="w-full h-64 object-cover rounded-lg shadow-md bg-gray-100"
                                  imageType="id"
                                  title={`Valid ID - ${user.name}`}
                                />
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Back</p>
                                <div className="w-full h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                  <p className="text-gray-400 text-sm">No image</p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-center py-12 text-gray-500 col-span-2">No valid ID uploaded</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'credentials' && (
                    <div className="h-full">
                      {verification.credentials.length > 0 ? (
                        <div className="overflow-x-auto pb-4">
                          <div className="flex gap-6 min-w-min">
                            {verification.credentials.map((credential, index) => (
                              <div key={index} className="flex-shrink-0" style={{ width: '500px' }}>
                                <p className="text-sm font-medium text-gray-700 mb-2">{credential.originalName || `Credential ${index + 1}`}</p>
                                <ClickableImage
                                  src={credential.cloudinaryUrl}
                                  alt={credential.originalName || `Credential ${index + 1}`}
                                  className="w-full h-[600px] object-cover rounded-lg shadow-md bg-gray-100"
                                  imageType="credential"
                                  title={`${credential.originalName || `Credential ${index + 1}`} - ${user.name}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-center py-12 text-gray-500">No credentials uploaded</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Verifications: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchVerifications();
    }
  }, [isAuthenticated, authLoading]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      
      if (!isAuthenticated) {
        return;
      }

      const response = await apiClient.get('/api/admin/verifications');
      
      if (response.data.success) {
        setVerifications(response.data.data || []);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVerifications();
    setRefreshing(false);
    toast.success('Verifications refreshed');
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

      const response = await apiClient.patch(
        `/api/admin/verifications/${verificationId}`,
        {
          status,
          adminNotes: notes,
          rejectionReason: reason
        }
      );

      if (response.data.success) {
        await fetchVerifications();
        setModalOpen(false);
      } else {
        throw new Error(response.data.message || 'Failed to update status');
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
  };

  const userVerifications = React.useMemo(() => {
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

  const filteredUsers = React.useMemo(() => {
    return userVerifications.filter(({ user, verifications }) => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        verifications.some(v => v.status === statusFilter);
      
      return matchesSearch && matchesStatus;
    });
  }, [userVerifications, searchTerm, statusFilter]);

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
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === 'pending'
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
              <div className="hidden md:block bg-white overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Submissions</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Documents</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Submitted</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map(({ user, verifications }) => {
                      const latestVerification = verifications[0];
                      const totalDocuments = verifications.reduce((sum, v) => 
                        sum + 1 + 1 + v.credentials.length, 0
                      );

                      return (
                        <tr 
                          key={user._id} 
                          onClick={() => openModal(latestVerification)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
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
                            <UserTypeBadge userType={user.userType} size="sm" />
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
                              {new Date(latestVerification.submittedAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(latestVerification.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {latestVerification.status === 'pending' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`Approve verification for ${user.name}?`)) return;
                                      try {
                                        await handleStatusUpdate(latestVerification._id, 'approved', 'Quick approved');
                                        toast.success('Verification approved');
                                      } catch (error) {
                                        toast.error('Failed to approve');
                                      }
                                    }}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="Approve"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const reason = window.prompt('Reason for rejection:');
                                      if (!reason || reason.trim() === '') {
                                        toast.error('Rejection reason required');
                                        return;
                                      }
                                      try {
                                        await handleStatusUpdate(latestVerification._id, 'rejected', 'Quick rejected', reason.trim());
                                        toast.success('Verification rejected');
                                      } catch (error) {
                                        toast.error('Failed to reject');
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Reject"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openModal(latestVerification)}
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

              {/* Mobile Cards */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {filteredUsers.map(({ user, verifications }) => {
                  const latestVerification = verifications[0];
                  const totalDocuments = verifications.reduce((sum, v) => 
                    sum + 1 + 1 + v.credentials.length, 0
                  );

                  return (
                    <div 
                      key={user._id} 
                      onClick={() => openModal(latestVerification)}
                      className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <UserAvatar user={user} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h3>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        <UserTypeBadge userType={user.userType} size="sm" />
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
                          <span>{new Date(latestVerification.submittedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {latestVerification.status === 'pending' && (
                            <>
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Approve verification for ${user.name}?`)) return;
                                  try {
                                    await handleStatusUpdate(latestVerification._id, 'approved', 'Quick approved');
                                    toast.success('Verification approved');
                                  } catch (error) {
                                    toast.error('Failed to approve');
                                  }
                                }}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  const reason = window.prompt('Reason for rejection:');
                                  if (!reason || reason.trim() === '') {
                                    toast.error('Rejection reason required');
                                    return;
                                  }
                                  try {
                                    await handleStatusUpdate(latestVerification._id, 'rejected', 'Quick rejected', reason.trim());
                                    toast.success('Verification rejected');
                                  } catch (error) {
                                    toast.error('Failed to reject');
                                  }
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => openModal(latestVerification)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      <UserDetailModal
        isOpen={modalOpen}
        onClose={closeModal}
        verification={selectedVerification}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
};

export default Verifications;
