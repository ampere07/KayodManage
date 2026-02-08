import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import type {
  User,
  Verification,
  PenaltyData
} from '../../types';
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
  const [verificationDetails, setVerificationDetails] = useState<Verification | null>(null);
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
      const expiresAt = new Date(user!.restrictionDetails!.expiresAt);
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
      // Use getUserById which now includes verificationAudit to avoid extra API confusion
      const fullUser = await usersService.getUserById(user._id);
      if (fullUser && fullUser.verificationAudit) {
        setVerificationDetails(fullUser.verificationAudit);
      } else {
        setVerificationDetails(null);
      }
    } catch (error) {
      console.error('Error fetching verification details:', error);
      setVerificationDetails(null);
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

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[100] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-white z-[101] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">User Information</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Quick Info (Sticky on Mobile) */}
        <div className="sticky top-[61px] md:relative md:top-0 z-20 bg-white border-b border-gray-100 px-4 md:px-6 py-6 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover ring-2 ring-gray-100"
                  />
                ) : (
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-blue-50 flex items-center justify-center ring-2 ring-blue-50">
                    <span className="text-xl md:text-2xl font-bold text-blue-600">
                      {getInitials(user.name)}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate">{user.name}</h3>
                <button
                  onClick={() => copyToClipboard(user._id)}
                  className="text-xs md:text-sm font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1"
                >
                  {formatKYDNumber(user._id)}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <VerificationStatusBadge isVerified={user.isVerified} />
              {user.userType && <UserTypeBadge userType={user.userType} />}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-6 space-y-8">
            {/* Personal Information */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">First Name</p>
                  <p className="text-sm font-medium text-gray-900">{firstName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Name</p>
                  <p className="text-sm font-medium text-gray-900">{lastName}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Date of Birth</p>
                  <p className="text-sm font-medium text-gray-900">
                    {user.dateOfBirth ? (
                      new Date(user.dateOfBirth).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    ) : (
                      'Not provided'
                    )}
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-gray-100" />

            {/* Contact Details */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Email Address</p>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Contact Number</p>
                  <p className="text-sm font-medium text-gray-900">{user.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Location</p>
                  <p className="text-sm font-medium text-gray-900">{user.location || 'N/A'}</p>
                </div>
              </div>
            </section>

            {/* Other Information */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Other Information</h3>
              <div className="space-y-6">
                {/* Account Timestamps */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Account Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Last Login</p>
                    <p className="text-sm font-medium text-gray-900">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Verification Summary */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Verification Status</p>
                    <p className={`text-xs font-bold ${user.isVerified ? 'text-green-600' : 'text-orange-500'}`}>
                      {user.isVerified ? 'VERIFIED' : 'PENDING'}
                    </p>
                  </div>
                  {user.isVerified && (
                    <>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">Verified By</p>
                        <p className="text-xs font-medium text-gray-900">
                          {loadingVerification ? '...' : (verificationDetails?.reviewedBy as any)?.name || 'N/A'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">Verification Date</p>
                        <p className="text-xs font-medium text-gray-900">
                          {loadingVerification ? '...' : verificationDetails?.reviewedAt ? new Date(verificationDetails.reviewedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-gray-100" />

                {/* Wallet - Keep Container */}
                <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Wallet Overview</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-blue-700">Available Balance</p>
                      <p className="text-xl font-black text-blue-900">₱{user.wallet?.availableBalance?.toLocaleString() || '0'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-blue-600">Held: ₱{user.wallet?.heldBalance?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>

                {user.categories && user.categories.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Professional Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {user.categories.map((cat, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded uppercase">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="border-t border-gray-100" />

            {/* Penalty Tracker */}
            <section className="pb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Security Audit</h3>
              {loadingPenalties ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Bans</p>
                      <p className="text-lg font-bold text-red-600">{penaltyData.totalPenalties}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Warnings</p>
                      <p className="text-lg font-bold text-yellow-600">{penaltyData.activeWarnings}</p>
                    </div>
                  </div>

                  {isRestricted && restrictionTimer && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Ban className="w-4 h-4 text-red-600" />
                        <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Active Restriction</p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-red-600">{restrictionTimer}</p>
                        <p className="text-[10px] text-red-700 font-medium uppercase">Remaining</p>
                      </div>
                      {user.restrictionDetails?.reason && (
                        <p className="mt-2 text-xs text-red-800 italic">"{user.restrictionDetails.reason}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-30 bg-white border-t border-gray-200 px-4 md:px-6 py-4">
          {confirmingAction ? (
            <div className="space-y-4">
              {confirmingAction !== 'unrestrict' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Days</p>
                      <input
                        type="number"
                        value={durationDays}
                        onChange={(e) => setDurationDays(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Hours</p>
                      <input
                        type="number"
                        value={durationHours}
                        onChange={(e) => setDurationHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                        className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Mins</p>
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for restriction..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmNo}
                  className="flex-1 h-11 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmYes}
                  className="flex-1 h-11 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {!isRestricted ? (
                <>
                  <button
                    onClick={() => handleActionClick('restrict')}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100"
                  >
                    <Shield className="w-5 h-5" />
                    Restrict
                  </button>
                  <button
                    onClick={() => handleActionClick('suspend')}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-100 rounded-lg hover:bg-yellow-100"
                  >
                    <Clock className="w-5 h-5" />
                    Suspend
                  </button>
                  <button
                    onClick={() => handleActionClick('ban')}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100"
                  >
                    <Ban className="w-5 h-5" />
                    Ban
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleActionClick('unrestrict')}
                  className="w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100"
                >
                  <UserX className="w-5 h-5" />
                  Restore Account Access
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default UserDetailsModal;
