import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import ClickableImage from '../UI/ClickableImage';
import UserTypeBadge from '../UI/UserTypeBadge';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import type { Verification, UserInfo } from '../../types';

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

interface VerificationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  verification: Verification | null;
  onStatusUpdate: (verificationId: string, status: string, notes?: string, reason?: string) => Promise<void>;
}

const VerificationDetailsModal: React.FC<VerificationDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  verification, 
  onStatusUpdate 
}) => {
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
                  {verification.status === 'pending' || verification.status === 'under_review' ? (
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

export default VerificationDetailsModal;
