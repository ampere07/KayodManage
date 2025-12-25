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
  const [penaltyData, setPenaltyData] = useState<PenaltyData>({
    totalPenalties: 0,
    activeWarnings: 0,
    lastPenalty: null
  });
  const [loadingPenalties, setLoadingPenalties] = useState(false);

  useEffect(() => {
    if (isOpen && user?.isVerified) {
      fetchVerificationDetails();
    }
    if (isOpen && user) {
      fetchPenaltyData();
    }
    if (!isOpen) {
      setConfirmingAction(null);
    }
  }, [isOpen, user]);

  const fetchVerificationDetails = async () => {
    if (!user?._id) return;
    
    setLoadingVerification(true);
    try {
      const details = await usersService.getVerificationDetails(user._id);
      setVerificationDetails(details);
    } catch (error) {
      console.error('Error fetching verification details:', error);
    } finally {
      setLoadingVerification(false);
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
      onAction(user, confirmingAction);
      setConfirmingAction(null);
      setTimeout(() => {
        fetchPenaltyData();
      }, 1000);
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
              <div className="space-y-2.5">
                <p className="text-base text-gray-900"><span className="text-gray-600">First Name:</span> {firstName}</p>
                <p className="text-base text-gray-900"><span className="text-gray-600">Last Name:</span> {lastName}</p>
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

            <div className="border-t border-gray-300 mb-6 -mx-6" />

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
                </div>
              )}
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

export default UserDetailsModal;
