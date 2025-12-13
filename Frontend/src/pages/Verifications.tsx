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
  RefreshCw,
  ChevronLeft,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient, { isNetworkError } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { checkImageExists, getPlaceholderImage } from '../utils/imageUtils';
import ClickableImage from '../components/UI/ClickableImage';



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
  status: 'approved' | 'rejected' | 'under_review';
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
    under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle }
  };

  const config = configs[status as keyof typeof configs] || configs.under_review;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status === 'under_review' ? 'Under Review' : status.charAt(0).toUpperCase() + status.slice(1)}
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
  onStatusUpdate: (verificationId: string, status: string, notes?: string, reason?: string) => Promise<void>;
}> = ({ verifications, onUserSelect, searchTerm, statusFilter, onStatusUpdate }) => {
  
  // Group verifications by user
  const userVerifications = React.useMemo(() => {
    const grouped = verifications.reduce((acc, verification) => {
      // Skip if userId is null or undefined
      if (!verification.userId) {
        return acc;
      }
      
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
      <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
        <div className="text-gray-400 mb-4">
          <Search className="h-12 w-12 mx-auto" />
        </div>
        <p className="text-gray-600 font-medium">No users found</p>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
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
            className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-100 hover:border-blue-200 cursor-pointer"
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

            {latestVerification.status === 'under_review' && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Approve verification for ${user.name}?`)) return;
                    try {
                      await onStatusUpdate(latestVerification._id, 'approved', 'Quick approved from list view');
                      toast.success('Verification approved');
                    } catch (error) {
                      toast.error('Failed to approve');
                    }
                  }}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors font-medium"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const reason = window.prompt('Reason for rejection:');
                    if (!reason || reason.trim() === '') {
                      toast.error('Rejection reason required');
                      return;
                    }
                    try {
                      await onStatusUpdate(latestVerification._id, 'rejected', 'Quick rejected from list view', reason.trim());
                      toast.success('Verification rejected');
                    } catch (error) {
                      toast.error('Failed to reject');
                    }
                  }}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors font-medium"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </button>
              </div>
            )}
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
  const [activeTab, setActiveTab] = useState<'face' | 'id' | 'credentials'>('face');
  const [updating, setUpdating] = useState(false);

  const userVerifications = verifications.filter(v => v.userId && v.userId._id === userId);
  const user = userVerifications[0]?.userId;

  useEffect(() => {
    if (userVerifications.length > 0 && !selectedVerification) {
      setSelectedVerification(userVerifications[0]);
    }
  }, [userVerifications, selectedVerification]);

  const handleQuickApprove = async () => {
    if (!selectedVerification) return;
    
    if (!window.confirm('Are you sure you want to approve this verification?')) {
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(selectedVerification._id, 'approved', 'Quick approved by admin');
      toast.success('Verification approved successfully');
    } catch (error) {
      toast.error('Failed to approve verification');
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickReject = async () => {
    if (!selectedVerification) return;

    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason || reason.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(selectedVerification._id, 'rejected', 'Quick rejected by admin', reason.trim());
      toast.success('Verification rejected');
    } catch (error) {
      toast.error('Failed to reject verification');
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

  const getValidIdType = () => {
    if (Array.isArray(selectedVerification.validId)) {
      return selectedVerification.validId[0]?.type || 'ID';
    }
    return selectedVerification.validId?.type || 'ID';
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
      </div>

      {/* User info card */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-gray-200">
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
          <div className="flex items-center gap-3">
            <StatusBadge status={selectedVerification.status} />
            {selectedVerification.status === 'under_review' && (
              <div className="flex gap-2">
                <button
                  onClick={handleQuickApprove}
                  disabled={updating}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </button>
                <button
                  onClick={handleQuickReject}
                  disabled={updating}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </button>
              </div>
            )}
          </div>
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

        {/* Side Tab Layout */}
        <div className="flex gap-6 pt-6">
          {/* Tab Navigation - Left Side */}
          <nav className="flex flex-col gap-2 min-w-[200px]" aria-label="Verification tabs">
            <button
              onClick={() => setActiveTab('face')}
              className={`px-4 py-3 rounded-lg text-left font-semibold text-sm transition-all ${
                activeTab === 'face'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              Face Verification
            </button>
            <button
              onClick={() => setActiveTab('id')}
              className={`px-4 py-3 rounded-lg text-left font-semibold text-sm transition-all ${
                activeTab === 'id'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              {getIdTypeLabel(getValidIdType())}
            </button>
            <button
              onClick={() => setActiveTab('credentials')}
              className={`px-4 py-3 rounded-lg text-left font-semibold text-sm transition-all ${
                activeTab === 'credentials'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              Credentials ({selectedVerification.credentials.length})
            </button>
          </nav>

          {/* Tab Content - Right Side */}
          <div className="flex-1">
          {/* Face Verification Tab */}
          {activeTab === 'face' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Face Verification</h3>
                  <p className="text-xs text-gray-600">
                    {selectedVerification.faceVerification?.uploadedAt 
                      ? `Uploaded ${new Date(selectedVerification.faceVerification.uploadedAt).toLocaleDateString()}`
                      : 'Upload date not available'
                    }
                  </p>
                </div>
              </div>
              <div>
                {!selectedVerification.faceVerification ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">No face verification uploaded</p>
                    <p className="text-xs text-gray-500">Face verification photos will appear here once submitted</p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.isArray(selectedVerification.faceVerification) ? (
                  selectedVerification.faceVerification.map((face, index) => {
                    const faceLabels = ['Left Side', 'Front View', 'Right Side'];
                    return (
                      <div key={index} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">{faceLabels[index]}</span>
                        </div>
                        <ClickableImage
                          src={face.cloudinaryUrl}
                          alt={`Face ${faceLabels[index]}`}
                          className="w-full aspect-square object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow"
                          imageType="face"
                          title={`Face Verification - ${faceLabels[index]} - ${user.name}`}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="md:col-start-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">1</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Face Photo</span>
                    </div>
                    <ClickableImage
                      src={selectedVerification.faceVerification.cloudinaryUrl}
                      alt="Face Verification"
                      className="w-full aspect-square object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow"
                      imageType="face"
                      title={`Face Verification - ${user.name}`}
                    />
                  </div>
                )}
                </div>
                )}
              </div>
            </div>
          )}

          {/* Valid ID Tab */}
          {activeTab === 'id' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <div className="p-2 bg-green-600 rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {getIdTypeLabel(getValidIdType())}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {selectedVerification.validId 
                      ? (Array.isArray(selectedVerification.validId) 
                        ? `Uploaded ${new Date(selectedVerification.validId[0]?.uploadedAt || Date.now()).toLocaleDateString()}`
                        : `Uploaded ${new Date(selectedVerification.validId.uploadedAt || Date.now()).toLocaleDateString()}`)
                      : 'Upload date not available'
                    }
                  </p>
                </div>
              </div>
              <div>
                {!selectedVerification.validId ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <Shield className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">No valid ID uploaded</p>
                    <p className="text-xs text-gray-500">Valid ID photos will appear here once submitted</p>
                  </div>
                ) : (
                <>
                {Array.isArray(selectedVerification.validId) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedVerification.validId.map((idDoc, index) => {
                      const idLabels = ['Front Side', 'Back Side'];
                      return (
                        <div key={index} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-sm font-semibold text-green-600">{index + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-700">{idLabels[index]}</span>
                          </div>
                          <ClickableImage
                            src={idDoc.cloudinaryUrl}
                            alt={`${getIdTypeLabel(idDoc.type || getValidIdType())} ${idLabels[index]}`}
                            className="w-full aspect-[16/10] object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow"
                            imageType="id"
                            title={`Valid ID (${getIdTypeLabel(idDoc.type || getValidIdType())} - ${idLabels[index]}) - ${user.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ClickableImage
                    src={selectedVerification.validId.cloudinaryUrl}
                    alt={getIdTypeLabel(getValidIdType())}
                    className="w-full max-w-2xl mx-auto rounded-lg shadow-md hover:shadow-xl transition-shadow"
                    imageType="id"
                    title={`Valid ID (${getIdTypeLabel(getValidIdType())}) - ${user.name}`}
                  />
                )}
                </>
                )}
              </div>
            </div>
          )}

          {/* Credentials Tab */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Professional Credentials
                  </h3>
                  <p className="text-xs text-gray-600">
                    {selectedVerification.credentials.length} {selectedVerification.credentials.length === 1 ? 'document' : 'documents'} uploaded
                  </p>
                </div>
              </div>
              <div>
                {selectedVerification.credentials.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">No credentials uploaded</p>
                    <p className="text-xs text-gray-500">Professional credentials will appear here once submitted</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex gap-6 pb-4">
                      {selectedVerification.credentials.map((credential, index) => (
                        <div key={index} className="flex-shrink-0 w-64 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-sm font-semibold text-purple-600">{index + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate flex-1" title={credential.originalName}>
                              {credential.originalName || `Credential ${index + 1}`}
                            </span>
                          </div>
                          <ClickableImage
                            src={credential.cloudinaryUrl}
                            alt={credential.originalName || `Credential ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow"
                            imageType="credential"
                            title={`${credential.originalName || `Credential ${index + 1}`} - ${user.name}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Previous review info */}
        {selectedVerification.reviewedBy && (
          <div className="pt-6 border-t border-gray-200">
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
    if (isAuthenticated && !authLoading) {
      fetchVerifications();
    } else if (!authLoading && !isAuthenticated) {
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
      console.log('📝 Updating verification status:');
      console.log('   Verification ID:', verificationId);
      console.log('   New Status:', status);
      console.log('   Admin Notes:', notes);
      console.log('   Rejection Reason:', reason);

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

      console.log('✅ Status update response:', response.data);

      if (response.data.success) {
        console.log('✅ Status updated successfully, refreshing verifications...');
        await fetchVerifications();
        console.log('✅ Verifications refreshed');
      } else {
        console.log('❌ Status update failed:', response.data.message);
        throw new Error(response.data.message || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('❌ Error in handleStatusUpdate:', error);
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

  if (authLoading) {
    return (
      <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">User Verifications</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">User Verifications</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-12 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
            <p className="text-yellow-600 font-medium mb-2">Authentication Required</p>
            <p className="text-sm text-yellow-500">
              Please log in with your admin credentials to access user verifications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    total: verifications.length,
    under_review: verifications.filter(v => v.status === 'under_review').length,
    approved: verifications.filter(v => v.status === 'approved').length,
    rejected: verifications.filter(v => v.status === 'rejected').length
  };

  if (loading) {
    return (
      <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">User Verifications</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">
              {retryCount > 0 ? `Retrying connection... (${retryCount}/${MAX_RETRY_ATTEMPTS})` : 'Loading verifications...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError && verifications.length === 0) {
    return (
      <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">User Verifications</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <p className="text-red-600 font-medium mb-2">Connection Error</p>
            <p className="text-sm text-red-500 mb-4">
              Unable to connect to the API server. Please check if the backend server is running.
            </p>
            <button
              onClick={() => fetchVerifications()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Verifications</h1>
          </div>
        </div>

        {!selectedUserId && (
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
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('under_review')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === 'under_review'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Under Review ({stats.under_review})
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === 'approved'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Approved ({stats.approved})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === 'rejected'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Rejected ({stats.rejected})
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
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
            onStatusUpdate={handleStatusUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default Verifications;
