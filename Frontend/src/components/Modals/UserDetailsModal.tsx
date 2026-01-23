import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Clock,
  Ban,
  UserX,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { usersService } from '../../services';
import type { User, VerificationDetails, PenaltyData } from '../../types';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import UserTypeBadge from '../UI/UserTypeBadge';
import toast from 'react-hot-toast';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onVerify: (userId: string, isVerified: boolean) => void;
  onAction: (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict', duration?: number, reason?: string) => void;
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
  const [durationDays, setDurationDays] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [penaltyData, setPenaltyData] = useState<PenaltyData>({
    totalPenalties: 0,
    activeWarnings: 0,
    lastPenalty: null
  });
  const [loadingPenalties, setLoadingPenalties] = useState(false);
  const [restrictionTimer, setRestrictionTimer] = useState<string | null>(null);
  const [restrictedByAdmin, setRestrictedByAdmin] = useState<{ _id: string; name: string } | null>(null);
  const [loadingRestrictedBy, setLoadingRestrictedBy] = useState(false);

  // Calculate remaining restriction time
  useEffect(() => {
    if (!user || !user.restrictionDetails?.expiresAt) {
      setRestrictionTimer(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const expiresAt = new Date(user.restrictionDetails.expiresAt);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs <= 0) {
        setRestrictionTimer('Expired');
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      let timeString = '';
      if (days > 0) timeString += `${days}d `;
      if (hours > 0) timeString += `${hours}h `;
      if (minutes > 0) timeString += `${minutes}m `;
      if (seconds > 0 && days === 0) timeString += `${seconds}s`;

      setRestrictionTimer(timeString.trim());
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (isOpen && user?.isVerified) {
      fetchVerificationDetails();
    }
    if (isOpen && user) {
      fetchPenaltyData();
      if (user.restrictionDetails?.restrictedBy) {
        const restrictedById = typeof user.restrictionDetails.restrictedBy === 'string' 
          ? user.restrictionDetails.restrictedBy 
          : user.restrictionDetails.restrictedBy._id;
        fetchRestrictedByAdmin(restrictedById);
      }
    }
    if (!isOpen) {
      setConfirmingAction(null);
      setDurationDays(0);
      setDurationHours(0);
      setDurationMinutes(0);
      setReason('');
      setRestrictedByAdmin(null);
    }
  }, [isOpen, user]);

  const fetchVerificationDetails = async () => {
    if (!user?._id) return;
    
    setLoadingVerification(true);
    try {
      const details = await usersService.getVerificationDetails(user._id);
      setVerificationDetails(details);
    } finally {
      setLoadingVerification(false);
    }
  };

  const fetchRestrictedByAdmin = async (adminId: string) => {
    setLoadingRestrictedBy(true);
    try {
      const admin = await usersService.getUserById(adminId);
      if (admin) {
        setRestrictedByAdmin({ _id: admin._id, name: admin.name });
      }
    } catch (error) {
      console.error('Error fetching restricted by admin:', error);
    } finally {
      setLoadingRestrictedBy(false);
    }
  };

  const fetchPenaltyData = async () => {
    if (!user?._id) return;
    
    setLoadingPenalties(true);
    try {
      const data = await usersService.getPenaltyData(user._id);
      
      const activeWarnings = user.accountStatus !== 'active' ? 1 : 0;
      
      setPenaltyData({
        ...data,
        activeWarnings
      });
    } catch (error) {
      console.error('Error fetching penalty data:', error);
    } finally {
      setLoadingPenalties(false);
    }
  };

  const handleActionClick = (actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict') => {
    setConfirmingAction(actionType);
  };

  const handleConfirmYes = () => {
    if (confirmingAction && user) {
      const totalDays = durationDays + (durationHours / 24) + (durationMinutes / (24 * 60));
      
      if (confirmingAction !== 'unrestrict' && totalDays <= 0) {
        toast.error('Please enter a duration for the restriction');
        return;
      }

      if (confirmingAction !== 'unrestrict' && !reason.trim()) {
        toast.error('Please provide a reason for the restriction');
        return;
      }
      
      onAction(
        user, 
        confirmingAction, 
        confirmingAction === 'unrestrict' ? undefined : totalDays,
        confirmingAction === 'unrestrict' ? undefined : reason
      );
      setConfirmingAction(null);
      setDurationDays(0);
      setDurationHours(0);
      setDurationMinutes(0);
      setReason('');
      setTimeout(() => {
        fetchPenaltyData();
      }, 1000);
    }
  };

  const handleConfirmNo = () => {
    setConfirmingAction(null);
    setDurationDays(0);
    setDurationHours(0);
    setDurationMinutes(0);
    setReason('');
  };

  const getActionLabel = () => {
    switch (confirmingAction) {
      case 'ban': return 'Ban';
      case 'suspend': return 'Suspend';
      case 'restrict': return 'Restrict';
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
        {/* Mobile Top Bar with Close Button */}
        <div className="md:hidden flex items-center justify-end px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop Header with Title and Close Button */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
          <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 md:px-6 py-6 flex-1 flex flex-col">
          {/* Mobile Title */}
          <h2 className="md:hidden text-xl font-semibold text-gray-900 mb-6">User Information</h2>
          
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

          <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Information</h3>
              <div className="space-y-2.5">
                <p className="text-base text-gray-900"><span className="text-gray-600">First Name:</span> {firstName}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Last Name:</span> {lastName}</p>
                <p className="text-base text-gray-900">
                  <span className="text-gray-600">Date of Birth:</span>{' '}
                  {user.dateOfBirth ? (
                    new Date(user.dateOfBirth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact</h3>
              <div className="space-y-2.5">
                <p className="text-base text-gray-900"><span className="text-gray-600">Email Address:</span> {user.email}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Contact Number:</span> {user.phone || 'N/A'}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Location:</span> {user.location || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

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

            <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

            <div className="flex-1 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Penalty Tracker</h3>
              {loadingPenalties ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Total Penalties:</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      penaltyData.totalPenalties > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {penaltyData.totalPenalties}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Active Warnings:</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      penaltyData.activeWarnings > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {penaltyData.activeWarnings}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Last Penalty:</p>
                    <p className="text-sm text-gray-900">
                      {penaltyData.lastPenalty 
                        ? new Date(penaltyData.lastPenalty).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'None'
                      }
                    </p>
                  </div>
                  {isRestricted && restrictionTimer && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-semibold text-red-900 mb-1">Restriction Time Remaining:</p>
                      <p className="text-2xl font-bold text-red-600">{restrictionTimer}</p>
                      {user.restrictionDetails?.type && (
                        <p className="text-xs text-red-700 mt-1 capitalize">{user.restrictionDetails.type}</p>
                      )}
                      {user.restrictionDetails?.restrictedBy && (
                        <div className="mt-2 pt-2 border-t border-red-200">
                          <p className="text-xs text-red-700">
                            <span className="font-semibold">Restricted By:</span>{' '}
                            {loadingRestrictedBy ? (
                              <span>Loading...</span>
                            ) : restrictedByAdmin ? (
                              <span>
                                {restrictedByAdmin.name} ({formatKYDNumber(restrictedByAdmin._id)})
                              </span>
                            ) : (
                              <span>N/A</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 justify-center mt-auto pt-6 -mx-4 md:-mx-6 px-4 md:px-6">
            {confirmingAction ? (
              <>
                {confirmingAction !== 'unrestrict' && (
                  <div className="w-full mb-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">{getActionLabel()} for:</label>
                      <div className="grid grid-cols-3 gap-3">
                        {/* Days Input */}
                        <div className="bg-white border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 focus-within:border-blue-500 transition-colors">
                          <label className="block text-xs font-medium text-gray-600 text-center mb-2">Days</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={durationDays}
                            onFocus={(e) => {
                              if (parseInt(e.target.value) === 0) {
                                setDurationDays(0);
                                e.target.select();
                              }
                            }}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              if (value === '') {
                                setDurationDays(0);
                              } else {
                                setDurationDays(parseInt(value));
                              }
                            }}
                            className="w-full text-2xl font-bold text-center text-gray-900 bg-transparent border-none focus:outline-none p-0"
                          />
                        </div>
                        
                        {/* Hours Input */}
                        <div className="bg-white border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 focus-within:border-blue-500 transition-colors">
                          <label className="block text-xs font-medium text-gray-600 text-center mb-2">Hours</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={durationHours}
                            onFocus={(e) => {
                              if (parseInt(e.target.value) === 0) {
                                setDurationHours(0);
                                e.target.select();
                              }
                            }}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              if (value === '') {
                                setDurationHours(0);
                              } else {
                                const num = parseInt(value);
                                setDurationHours(Math.min(23, num));
                              }
                            }}
                            className="w-full text-2xl font-bold text-center text-gray-900 bg-transparent border-none focus:outline-none p-0"
                          />
                        </div>
                        
                        {/* Minutes Input */}
                        <div className="bg-white border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 focus-within:border-blue-500 transition-colors">
                          <label className="block text-xs font-medium text-gray-600 text-center mb-2">Minutes</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={durationMinutes}
                            onFocus={(e) => {
                              if (parseInt(e.target.value) === 0) {
                                setDurationMinutes(0);
                                e.target.select();
                              }
                            }}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              if (value === '') {
                                setDurationMinutes(0);
                              } else {
                                const num = parseInt(value);
                                setDurationMinutes(Math.min(59, num));
                              }
                            }}
                            className="w-full text-2xl font-bold text-center text-gray-900 bg-transparent border-none focus:outline-none p-0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reason:</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Enter the reason for this restriction..."
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors resize-none text-sm"
                      />
                    </div>
                  </div>
                )}
                <div className="w-full flex gap-3">
                  <button
                    onClick={handleConfirmNo}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmYes}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    Confirm
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {!isRestricted ? (
                  <>
                    <button
                      onClick={() => handleActionClick('restrict')}
                      className="flex items-center justify-center gap-1.5 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Restrict
                    </button>
                    <button
                      onClick={() => handleActionClick('suspend')}
                      className="flex items-center justify-center gap-1.5 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Suspend
                    </button>
                    <button
                      onClick={() => handleActionClick('ban')}
                      className="flex items-center justify-center gap-1.5 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    >
                      <Ban className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Ban
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleActionClick('unrestrict')}
                    className="flex items-center justify-center gap-1.5 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                  >
                    <UserX className="h-3.5 w-3.5 md:h-4 md:w-4" />
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

export default UserDetailsModal;
