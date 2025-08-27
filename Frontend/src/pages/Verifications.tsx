import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  User, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye,
  Image,
  Calendar,
  AlertCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient, { isNetworkError } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { checkImageExists, getPlaceholderImage } from '../utils/imageUtils';

// Safe image component with error handling
const SafeImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  imageType?: 'face' | 'id' | 'credential';
}> = ({ src, alt, className = '', imageType = 'credential' }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(getPlaceholderImage(imageType));
    }
  };

  const handleLoad = () => {
    setHasError(false);
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
};

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
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: UserInfo;
  adminNotes?: string;
  rejectionReason?: string;
  verificationAttempts: number;
}

// Status badge component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs = {
    approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle },
    pending: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock }
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </span>
  );
};

// User avatar component
const UserAvatar: React.FC<{ user: UserInfo; size?: 'sm' | 'md' | 'lg' }> = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  if (user.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={user.name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center`}>
      <User className={`${size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'} text-gray-500`} />
    </div>
  );
};

// Stats card component
const StatsCard: React.FC<{ title: string; value: number; icon: React.ElementType; color: string }> = ({ 
  title, value, icon: Icon, color 
}) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <Icon className={`w-8 h-8 ${color.replace('text', 'text-opacity-50')}`} />
    </div>
  </div>
);

// User list view component
const UserListView: React.FC<{ 
  verifications: Verification[];
  onUserSelect: (userId: string) => void;
  searchTerm: string;
  statusFilter: string;
}> = ({ verifications, onUserSelect, searchTerm, statusFilter }) => {
  
  // Group verifications by user
  const userVerifications = React.useMemo(() => {
    const grouped = verifications.reduce((acc, verification) => {
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

  // Filter users
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

  if (filteredUsers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
        <p className="text-gray-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredUsers.map(({ user, verifications }) => {
        const latestVerification = verifications[0];
        const totalDocuments = verifications.reduce((sum, v) => 
          sum + 1 + 1 + v.credentials.length, 0
        );

        return (
          <div
            key={user._id}
            onClick={() => onUserSelect(user._id)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <UserAvatar user={user} size="lg" />
                <div className="ml-4">
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                    {user.userType}
                  </span>
                </div>
              </div>
              <Eye className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Latest Status</span>
                <StatusBadge status={latestVerification.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Submissions</span>
                <span className="text-sm font-medium text-gray-900">{verifications.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Documents</span>
                <span className="inline-flex items-center text-sm text-gray-600">
                  <Image className="w-4 h-4 mr-1" />
                  {totalDocuments}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Submitted</span>
                <span className="text-sm text-gray-600">
                  {new Date(latestVerification.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// User detail view component
const UserDetailView: React.FC<{
  userId: string;
  verifications: Verification[];
  onBack: () => void;
  onStatusUpdate: (verificationId: string, status: string, notes?: string, reason?: string) => Promise<void>;
}> = ({ userId, verifications, onBack, onStatusUpdate }) => {
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [activeImageTab, setActiveImageTab] = useState<'face' | 'validId' | 'credentials'>('face');
  const [updateStatus, setUpdateStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [updating, setUpdating] = useState(false);

  const userVerifications = verifications.filter(v => v.userId._id === userId);
  const user = userVerifications[0]?.userId;

  useEffect(() => {
    if (userVerifications.length > 0 && !selectedVerification) {
      setSelectedVerification(userVerifications[0]);
    }
  }, [userVerifications, selectedVerification]);

  const handleStatusUpdate = async () => {
    if (!selectedVerification || !updateStatus) {
      toast.error('Please select a status');
      return;
    }

    if (updateStatus === 'rejected' && !rejectionReason) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(selectedVerification._id, updateStatus, adminNotes, rejectionReason);
      toast.success('Verification status updated');
      setUpdateStatus('');
      setAdminNotes('');
      setRejectionReason('');
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (!user || !selectedVerification) {
    return <div>Loading...</div>;
  }

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

  return (
    <div className="space-y-6">
      {/* Back button and header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Users
        </button>
        <RefreshCw className="w-5 h-5 text-gray-400" />
      </div>

      {/* User info card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <UserAvatar user={user} size="lg" />
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {user.userType}
                </span>
                <span className="text-xs text-gray-500">ID: {user._id}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={selectedVerification.status} />
        </div>

        {/* Submission selector if multiple */}
        {userVerifications.length > 1 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Submission
            </label>
            <select
              value={selectedVerification._id}
              onChange={(e) => {
                const verification = userVerifications.find(v => v._id === e.target.value);
                if (verification) setSelectedVerification(verification);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {userVerifications.map((v, index) => (
                <option key={v._id} value={v._id}>
                  Submission {index + 1} - {new Date(v.submittedAt).toLocaleDateString()} - {v.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Image tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveImageTab('face')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeImageTab === 'face'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Face Verification
            </button>
            <button
              onClick={() => setActiveImageTab('validId')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeImageTab === 'validId'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Valid ID ({getIdTypeLabel(selectedVerification.validId.type)})
            </button>
            <button
              onClick={() => setActiveImageTab('credentials')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeImageTab === 'credentials'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Credentials ({selectedVerification.credentials.length})
            </button>
          </nav>
        </div>

        {/* Image display */}
        <div className="mb-6">
          {activeImageTab === 'face' && (
            <div className="space-y-4">
              <SafeImage
                src={selectedVerification.faceVerification.cloudinaryUrl}
                alt="Face Verification"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                imageType="face"
              />
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Uploaded: {new Date(selectedVerification.faceVerification.uploadedAt).toLocaleString()}</span>
                <a
                  href={selectedVerification.faceVerification.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </a>
              </div>
            </div>
          )}

          {activeImageTab === 'validId' && (
            <div className="space-y-4">
              <SafeImage
                src={selectedVerification.validId.cloudinaryUrl}
                alt={getIdTypeLabel(selectedVerification.validId.type)}
                className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
                imageType="id"
              />
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Type: {getIdTypeLabel(selectedVerification.validId.type)}</span>
                <a
                  href={selectedVerification.validId.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </a>
              </div>
            </div>
          )}

          {activeImageTab === 'credentials' && (
            <div className="space-y-4">
              {selectedVerification.credentials.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No credentials uploaded</p>
              ) : (
                selectedVerification.credentials.map((credential, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">{credential.originalName || `Credential ${index + 1}`}</p>
                        <p className="text-sm text-gray-500">
                          Uploaded: {new Date(credential.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <a
                        href={credential.cloudinaryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm inline-flex items-center"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </a>
                    </div>
                    <SafeImage
                      src={credential.cloudinaryUrl}
                      alt={credential.originalName || `Credential ${index + 1}`}
                      className="w-full rounded-lg"
                      imageType="credential"
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Status update section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="font-medium mb-4">Update Verification Status</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Status</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {updateStatus === 'rejected' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Provide a clear reason for rejection..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Internal notes (optional)..."
              />
            </div>

            <button
              onClick={handleStatusUpdate}
              disabled={updating || !updateStatus}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>

        {/* Previous review info */}
        {selectedVerification.reviewedBy && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Review History</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Reviewed by:</span>{' '}
                <span className="font-medium">{selectedVerification.reviewedBy.name}</span>
              </div>
              {selectedVerification.reviewedAt && (
                <div>
                  <span className="text-gray-500">Reviewed at:</span>{' '}
                  <span>{new Date(selectedVerification.reviewedAt).toLocaleString()}</span>
                </div>
              )}
              {selectedVerification.adminNotes && (
                <div>
                  <span className="text-gray-500">Admin notes:</span>{' '}
                  <span>{selectedVerification.adminNotes}</span>
                </div>
              )}
              {selectedVerification.rejectionReason && (
                <div className="p-3 bg-red-50 rounded mt-2">
                  <span className="text-red-600 font-medium">Rejection reason:</span>{' '}
                  <span className="text-red-700">{selectedVerification.rejectionReason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Verifications component
const Verifications: React.FC = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 2000;

  useEffect(() => {
    // Only fetch verifications if user is authenticated and auth is not loading
    if (isAuthenticated && !authLoading) {
      fetchVerifications();
    } else if (!authLoading && !isAuthenticated) {
      // User is not authenticated
      setLoading(false);
      setConnectionError(false);
    }
  }, [isAuthenticated, authLoading]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchVerifications = async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setConnectionError(false);
      
      if (!isAuthenticated) {
        toast.error('Please login to access this page');
        setLoading(false);
        return;
      }

      // Using apiClient with session/cookie authentication - no need for manual headers
      const response = await apiClient.get('/api/admin/verifications');
      
      if (response.data.success) {
        setVerifications(response.data.data || []);
        setRetryCount(0);
      } else {
        throw new Error(response.data.message || 'Failed to load verifications');
      }
    } catch (error: any) {
      console.error('Error fetching verifications:', error);
      
      const isNetworkErrorDetected = isNetworkError(error);
      
      if (isNetworkErrorDetected && retryAttempt < MAX_RETRY_ATTEMPTS) {
        setRetryCount(retryAttempt + 1);
        toast.error(`Connection failed. Retrying in ${RETRY_DELAY / 1000}s... (${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await sleep(RETRY_DELAY);
        return fetchVerifications(retryAttempt + 1);
      }
      
      setConnectionError(true);
      
      if (isNetworkErrorDetected) {
        toast.error('Cannot connect to server. Please check if the API server is running.');
      } else if (error.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        // Let AuthContext handle the logout
      } else if (error.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to load verifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVerifications();
    setRefreshing(false);
    if (!connectionError) {
      toast.success('Verifications refreshed');
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

      // Using apiClient with session/cookie authentication - no need for manual headers
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
      } else {
        throw new Error(response.data.message || 'Failed to update status');
      }
    } catch (error: any) {
      const isNetworkErrorDetected = isNetworkError(error);
      
      if (isNetworkErrorDetected) {
        throw new Error('Cannot connect to server. Please check your connection.');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else {
        throw new Error(error.response?.data?.message || error.message || 'Failed to update status');
      }
    }
  };

  // Check authentication first
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Authentication Required</h2>
          <p className="text-yellow-600 mb-4">
            You need to be logged in as an admin to access user verifications.
          </p>
          <p className="text-sm text-yellow-600">
            Please log in with your admin credentials to continue.
          </p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const stats = {
    total: verifications.length,
    pending: verifications.filter(v => v.status === 'pending').length,
    approved: verifications.filter(v => v.status === 'approved').length,
    rejected: verifications.filter(v => v.status === 'rejected').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {retryCount > 0 ? `Retrying connection... (${retryCount}/${MAX_RETRY_ATTEMPTS})` : 'Loading verifications...'}
          </p>
        </div>
      </div>
    );
  }

  // Connection error state
  if (connectionError && verifications.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Connection Error</h2>
          <p className="text-red-600 mb-4">
            Unable to connect to the API server. Please check if the backend server is running.
          </p>
          <div className="space-y-2 text-sm text-red-600 mb-6">
            <p>• Ensure the backend server is running</p>
            <p>• Check your network connection</p>
            <p>• Verify the API URL configuration</p>
          </div>
          <button
            onClick={() => fetchVerifications()}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
      <div>
      <h1 className="text-3xl font-bold text-gray-900">User Verifications</h1>
      <p className="text-gray-600 mt-2">
          Review and manage user verification documents
          {connectionError && (
          <span className="ml-2 inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
            <AlertCircle className="w-3 h-3 mr-1" />
            Connection issues detected
        </span>
        )}
        </p>
      </div>
      <button
        onClick={handleRefresh}
          disabled={refreshing}
            className={`flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
              refreshing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatsCard title="Total" value={stats.total} icon={Shield} color="text-gray-900" />
          <StatsCard title="Pending" value={stats.pending} icon={Clock} color="text-yellow-600" />
          <StatsCard title="Approved" value={stats.approved} icon={CheckCircle} color="text-green-600" />
          <StatsCard title="Rejected" value={stats.rejected} icon={XCircle} color="text-red-600" />
        </div>

        {/* Filters - only show when not viewing user details */}
        {!selectedUserId && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      {selectedUserId ? (
        <UserDetailView
          userId={selectedUserId}
          verifications={verifications}
          onBack={() => setSelectedUserId(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      ) : (
        <UserListView
          verifications={verifications}
          onUserSelect={setSelectedUserId}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
        />
      )}
    </div>
  );
};

export default Verifications;
