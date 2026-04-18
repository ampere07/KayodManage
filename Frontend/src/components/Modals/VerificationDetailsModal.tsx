import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import verificationsService from '../../services/verificationsService';
import ClickableImage from '../UI/ClickableImage';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import type { Verification, UserInfo } from '../../types';
import { SidebarContext } from '../Layout/Layout';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

// Function to format normalized profession names to display format
const formatCredentialName = (name: string): string => {
  // Convert camelCase or lowercase with spaces to proper format
  return name
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
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
  onStatusUpdate: (verificationId: string, status: string, notes?: string, reason?: string, banUser?: boolean) => Promise<void>;
}

const VerificationDetailsModal: React.FC<VerificationDetailsModalProps> = ({
  isOpen,
  onClose,
  verification,
  onStatusUpdate
}) => {
  const formatDateTime = (value?: string | number | Date | null) => {
    if (!value) return 'N/A';
    try {
      return new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const [activeTab, setActiveTab] = useState<'face' | 'credentials'>('face');
  const [showMobileDocs, setShowMobileDocs] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<number>(1);
  const [attemptImages, setAttemptImages] = useState<any>(null);
  const [attemptCache, setAttemptCache] = useState<Record<number, { images: any; submittedAt: string | null }>>({});
  const [attemptTimestamps, setAttemptTimestamps] = useState<{ attempt: number; submittedAt: string | Date | null }[] | null>(null);
  const [currentAttemptSubmittedAt, setCurrentAttemptSubmittedAt] = useState<string | Date | null>(null);
  const { setIsHeaderHidden } = React.useContext(SidebarContext);

  useEffect(() => {
    if (setIsHeaderHidden) {
      setIsHeaderHidden(isOpen);
    }
    return () => {
      if (setIsHeaderHidden) {
        setIsHeaderHidden(false);
      }
    };
  }, [isOpen, setIsHeaderHidden]);

  const prevVerificationId = useRef<string | null>(null);

  // Dragging refs
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);

  // Reset transform when sheet opens/closes to ensure clean state
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
      sheetRef.current.style.transition = '';
    }
  }, [showMobileDocs]);

  // Reset selected attempt only when verification id changes
  useEffect(() => {
    if (verification) {
      if (prevVerificationId.current !== verification._id) {
        const attemptsFromVerification = (verification as any)?.attempts;
        const latestAttemptNumber = Array.isArray(attemptsFromVerification) && attemptsFromVerification.length > 0
          ? attemptsFromVerification[attemptsFromVerification.length - 1].attemptNumber || attemptsFromVerification.length
          : verification.verificationAttempts || 1;
        setSelectedAttempt(latestAttemptNumber);
        // Seed cache from attempts if media exists
        const seededCache: Record<number, { images: any; submittedAt: string | null }> = {};
        if (Array.isArray(attemptsFromVerification) && attemptsFromVerification.length > 0) {
          attemptsFromVerification.forEach((a: any, idx: number) => {
            const attemptNum = a?.attemptNumber ?? idx + 1;
            seededCache[attemptNum] = {
              images: {
                faceVerification: a?.faceVerification || [],
                validId: a?.validId || [],
                credentials: a?.credentials || [],
              },
              submittedAt: a?.submittedAt || null,
            };
          });
        }
        setAttemptCache(seededCache);
        setAttemptImages(seededCache[latestAttemptNumber]?.images || null); // show latest immediately if present
        // Seed attempt timestamps from verification attempts if present
        if (Array.isArray((verification as any).attempts) && (verification as any).attempts.length > 0) {
          const mapped = (verification as any).attempts
            .filter((a: any) => a)
            .map((a: any, idx: number) => ({
              attempt: a.attemptNumber ?? idx + 1,
              submittedAt: a.submittedAt ?? null
            }));
          setAttemptTimestamps(mapped);
        } else {
          setAttemptTimestamps(null);
        }
        setCurrentAttemptSubmittedAt(verification.submittedAt || null);
        prevVerificationId.current = verification._id;
      }
    }
  }, [verification]);

  // Fetch images for a specific attempt from backend (Cloudinary URLs already stored)
  const fetchAttemptImages = async (attemptNumber: number) => {
    if (!verification?.userId?._id) return;

    // Serve from cache if already fetched
    if (attemptCache[attemptNumber]) {
      setAttemptImages(attemptCache[attemptNumber].images);
      setCurrentAttemptSubmittedAt(attemptCache[attemptNumber].submittedAt || null);
      return;
    }

    try {
      const { data } = await verificationsService.getUserImages(
        verification.userId._id,
        attemptNumber
      );

      // API returns images from DB (Cloudinary URLs) for the requested attempt
      const cacheBust = Date.now();
      const addBust = (img: any) =>
        img && img.cloudinaryUrl
          ? { ...img, cloudinaryUrl: `${img.cloudinaryUrl}?cb=${cacheBust}` }
          : img;

      const withCacheBust = {
        faceVerification: Array.isArray(data.images.faceVerification)
          ? data.images.faceVerification.map(addBust)
          : addBust(data.images.faceVerification),
        validId: Array.isArray(data.images.validId)
          ? data.images.validId.map(addBust)
          : addBust(data.images.validId),
        credentials: Array.isArray(data.images.credentials)
          ? data.images.credentials.map(addBust)
          : addBust(data.images.credentials)
      };

      setAttemptImages(withCacheBust);
      setAttemptCache((prev) => ({
        ...prev,
        [attemptNumber]: {
          images: withCacheBust,
          submittedAt: data.attemptSubmittedAt || null
        }
      }));
      setAttemptTimestamps(data.attemptTimestamps || null);
      setCurrentAttemptSubmittedAt(data.attemptSubmittedAt || null);
    } catch (error) {
      console.error('Failed to fetch attempt images:', error);
      toast.error('Failed to load images for this attempt');
    }
  };

  // Handle attempt click
  const handleAttemptClick = (attemptNumber: number) => {
    setSelectedAttempt(attemptNumber);
    const cached = attemptCache[attemptNumber];
    if (cached) {
      setAttemptImages(cached.images);
      setCurrentAttemptSubmittedAt(cached.submittedAt || null);
    } else {
      setAttemptImages(null); // clear only if not cached
      setCurrentAttemptSubmittedAt(null);
    }
    fetchAttemptImages(attemptNumber);
  };

  // Get current images based on selected attempt
  const getCurrentImages = () => {
    if (attemptCache[selectedAttempt]?.images) return attemptCache[selectedAttempt].images;
    if (attemptImages) return attemptImages;
    const attemptsFromVerification = (verification as any)?.attempts;
    if (Array.isArray(attemptsFromVerification) && attemptsFromVerification.length > 0) {
      const match = attemptsFromVerification.find((a: any) => a?.attemptNumber === selectedAttempt);
      const fallback = attemptsFromVerification[attemptsFromVerification.length - 1];
      const data = match || fallback;
      return {
        faceVerification: data?.faceVerification || [],
        validId: data?.validId || [],
        credentials: data?.credentials || []
      };
    }
    return {
      faceVerification: verification?.faceVerification || [],
      validId: verification?.validId || [],
      credentials: verification?.credentials || []
    };
  };

  const currentImages = getCurrentImages();

  const getAttemptTimestamp = (attemptNumber: number) => {
    const found = attemptTimestamps?.find((a) => a.attempt === attemptNumber);
    if (found?.submittedAt) return found.submittedAt;
    const attemptsFromVerification = (verification as any)?.attempts;
    if (Array.isArray(attemptsFromVerification)) {
      const fallback = attemptsFromVerification.find((a: any) => (a?.attemptNumber ?? null) === attemptNumber);
      if (fallback?.submittedAt) return fallback.submittedAt;
    }
    return null;
  };

  const attemptsForHistory = (() => {
    const attemptsFromVerification = (verification as any)?.attempts;
    if (Array.isArray(attemptsFromVerification) && attemptsFromVerification.length > 0) {
      return attemptsFromVerification
        .map((a: any, idx: number) => ({
          attempt: a?.attemptNumber ?? idx + 1,
          submittedAt: a?.submittedAt ?? null
        }))
        .sort((a, b) => {
          const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : Number.MIN_SAFE_INTEGER;
          const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : Number.MIN_SAFE_INTEGER;
          if (bTime !== aTime) return bTime - aTime;
          return b.attempt - a.attempt;
        });
    }
    const total = verification?.verificationAttempts || 1;
    const map = new Map<number, string | Date | null>();
    attemptTimestamps?.forEach((a) => map.set(a.attempt, a.submittedAt ?? null));
    const arr = Array.from({ length: total }, (_, idx) => {
      const attemptNum = idx + 1;
      return {
        attempt: attemptNum,
        submittedAt: map.has(attemptNum) ? map.get(attemptNum) || null : null
      };
    });
    return arr.sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : Number.MIN_SAFE_INTEGER;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : Number.MIN_SAFE_INTEGER;
      if (bTime !== aTime) return bTime - aTime;
      return b.attempt - a.attempt; // fallback to attempt number desc
    });
  })();

  const sortedAttempts = attemptsForHistory.length ? attemptsForHistory : null;

  const latestAttemptForHistory = sortedAttempts?.length
    ? sortedAttempts[0].attempt
    : verification?.verificationAttempts || 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartY.current;

    if (delta > 0) {
      // e.preventDefault(); // Removed because of passive listener error. Relying on touch-action: none via CSS class.
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;

    const currentY = e.changedTouches[0].clientY;
    const delta = currentY - dragStartY.current;

    // Restore transition for snap animation
    sheetRef.current.style.transition = 'transform 0.3s ease-out';

    const height = sheetRef.current.offsetHeight;
    const threshold = height * 0.6; // 60% threshold

    if (delta > threshold) { // Threshold to close
      setShowMobileDocs(false);
      sheetRef.current.style.transform = '';
    } else {
      // Snap back to open
      sheetRef.current.style.transform = '';
    }
  };

  if (!isOpen || !verification) return null;

  const user = verification.userId;

  // Attempt-level helpers
  const attemptsFromVerification = (verification as any)?.attempts;
  const latestAttemptNumber = attemptsFromVerification?.length
    ? attemptsFromVerification[attemptsFromVerification.length - 1].attemptNumber
    : verification.verificationAttempts || 1;
  const displayAttemptCount = attemptsFromVerification?.length || verification.verificationAttempts || 1;

  const selectedAttemptData = attemptsFromVerification?.find((a: any) => a?.attemptNumber === selectedAttempt)
    || attemptsFromVerification?.[attemptsFromVerification.length - 1]
    || null;

  // Count submitted documents for the selected attempt
  const hasFaceVerification = selectedAttemptData?.faceVerification
    ? (Array.isArray(selectedAttemptData.faceVerification) ? selectedAttemptData.faceVerification.length > 0 : true)
    : Array.isArray(currentImages.faceVerification) ? currentImages.faceVerification.length > 0 : !!currentImages.faceVerification;

  const hasValidId = selectedAttemptData?.validId
    ? (Array.isArray(selectedAttemptData.validId) ? selectedAttemptData.validId.length > 0 : true)
    : Array.isArray(currentImages.validId) ? currentImages.validId.length > 0 : !!currentImages.validId;

  const hasCredentials = selectedAttemptData?.credentials
    ? Array.isArray(selectedAttemptData.credentials) ? selectedAttemptData.credentials.length > 0 : !!selectedAttemptData.credentials
    : Array.isArray(currentImages.credentials) ? currentImages.credentials.length > 0 : !!currentImages.credentials;

  const documentsSubmitted = [hasFaceVerification, hasValidId, hasCredentials].filter(Boolean).length;

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
    const reason = window.prompt('Please provide a reason for rejection (this will also BAN the user):');
    if (!reason || reason.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(verification._id, 'rejected', 'Rejected and Banned by admin', reason.trim(), true);
      toast.success('Verification rejected and user banned');
    } catch (error) {
      toast.error('Failed to reject and ban user');
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestResubmission = async () => {
    const notes = window.prompt('Please specify what the user needs to resubmit:');
    if (!notes || notes.trim() === '') {
      toast.error('Resubmission notes are required');
      return;
    }

    setUpdating(true);
    try {
      await onStatusUpdate(verification._id, 'resubmission_requested', notes.trim());
      toast.success('Resubmission requested');
    } catch (error) {
      toast.error('Failed to request resubmission');
    } finally {
      setUpdating(false);
    }
  };

  const handleFlagForReview = async () => {
    const notes = window.prompt('Reason for flagging (optional):');

    setUpdating(true);
    try {
      await onStatusUpdate(verification._id, 'flagged', notes?.trim() || 'Flagged for further review');
      toast.success('Verification flagged for review');
    } catch (error) {
      toast.error('Failed to flag verification');
    } finally {
      setUpdating(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className={`fixed inset-0 md:left-72 bg-white shadow-2xl z-[110] transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
        <div className="h-full flex flex-col relative">
          {/* Mobile Backdrop for Bottom Sheet */}
          <div
            className={`md:hidden fixed inset-0 bg-black/60 z-[115] transition-opacity duration-300 ${showMobileDocs ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            onClick={() => setShowMobileDocs(false)}
          />

          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
              <div className="relative flex-shrink-0">
                <UserAvatar user={user} size="md" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 truncate">{user.name}</h3>
                  <VerificationStatusBadge isVerified={verification.status === 'approved'} size="sm" />
                  <UserTypeBadge userType={user.userType} size="sm" />
                </div>
                <div className="flex items-center gap-3 text-xs md:text-sm text-gray-600">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user._id);
                      toast.success('KYD copied to clipboard');
                    }}
                    className="hover:text-blue-600 cursor-pointer transition-colors truncate"
                    title="Click to copy"
                  >
                    KYD: {user._id}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row md:relative">
            {/* Left Column - User Information */}
            <div className="relative w-full md:w-[400px] flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white md:bg-gray-50 flex flex-col h-full overflow-hidden">
              <div className="overflow-y-auto flex-1 pb-24 md:pb-0">
                <div className="p-4 md:p-6">
                  {/* Personal Information */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2.5">
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">First Name:</span> {user.name.split(' ')[0]}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Age:</span> N/A
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Last Name:</span> {user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0]}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Birthdate:</span> N/A
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

                  {/* Contact */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact</h3>
                    <div className="space-y-2.5">
                      <p className="text-sm md:text-base text-gray-900 break-all">
                        <span className="text-gray-600">Email Address:</span> {user.email}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Contact Number:</span> N/A
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Location:</span> N/A
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

                  {/* Verification Details */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Verification Details</h3>
                        <div className="text-sm text-gray-600">
                          Viewing: <span className="font-medium text-indigo-600">Attempt {selectedAttempt}</span>
                        </div>
                      </div>
                    <div className="space-y-2.5">
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Verification Status:</span>{' '}
                        {verification.status === 'approved' ? 'Verified' : verification.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Verified By:</span>{' '}
                        {verification.reviewedBy ? verification.reviewedBy.name : 'N/A'}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Verification Date:</span>{' '}
                        {verification.reviewedAt ? new Date(verification.reviewedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'N/A'}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Attempts:</span> {displayAttemptCount}
                      </p>
                      <p className="text-sm md:text-base text-gray-900">
                        <span className="text-gray-600">Documents Uploaded:</span> {documentsSubmitted} out of 3
                      </p>
                      <div className="mt-2 ml-4">
                        <ul className="list-disc text-sm text-gray-700 space-y-1">
                          {hasFaceVerification && <li>Face Verification</li>}
                          {hasValidId && <li>Identification Card</li>}
                          {hasCredentials && <li>Certificate/Credentials</li>}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-300 mb-6 -mx-4 md:-mx-6" />

                  {/* Submission History */}
                  <div className="mb-6">
                    <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-4">SUBMISSION HISTORY</h3>
                    <div className="space-y-4 relative">
                      {/* Vertical line */}
                      <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-gray-300" />

                      {verification.status === 'approved' && verification.reviewedAt && (
                        <div className="flex items-start gap-3 relative">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center z-10">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">Verification Approved</p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(verification.reviewedAt)} - {verification.reviewedBy?.name || 'System Auto-Approval'}
                            </p>
                          </div>
                        </div>
                      )}
                      {verification.status === 'rejected' && verification.reviewedAt && (
                        <div className="flex items-start gap-3 relative">
                          <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center z-10">
                            <XCircle className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">Verification Rejected</p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(verification.reviewedAt)} - {verification.reviewedBy?.name || 'Admin'}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Render attempts >1 in descending order before documents using attemptTimestamps when available */}
                      {attemptsForHistory
                        .filter((a) => a.attempt > 1)
                        .map(({ attempt: attemptNumber, submittedAt }) => {
                          const isSelected = selectedAttempt === attemptNumber;
                          const isCurrent = attemptNumber === latestAttemptForHistory;
                          return (
                            <div
                              key={`attempt-${attemptNumber}`}
                              className={`flex items-start gap-3 relative cursor-pointer transition-all duration-200 ${isSelected ? 'bg-indigo-50 -mx-4 px-4 py-2 rounded-lg' : 'hover:bg-gray-50 -mx-4 px-4 py-2 rounded-lg'}`}
                              onClick={() => handleAttemptClick(attemptNumber)}
                            >
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-indigo-100'}`}>
                                <svg className={`w-4 h-4 transition-colors ${isSelected ? 'text-white' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-medium transition-colors ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>Verification Attempt {attemptNumber}</p>
                                <p className="text-xs text-gray-500">
                                  {submittedAt ? formatDateTime(submittedAt) : 'N/A'} - {isCurrent ? 'Current attempt' : `Previous attempt ${attemptNumber}`}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="flex-shrink-0">
                                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      <div className="flex items-start gap-3 relative">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center z-10">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Documents Submitted</p>
                          <p className="text-xs text-gray-500">
                            {new Date(verification.submittedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })} - {documentsSubmitted} document{documentsSubmitted !== 1 ? 's' : ''} uploaded
                          </p>
                        </div>
                      </div>
                      {(sortedAttempts?.length ? sortedAttempts.some((a) => a.attempt === 1) : displayAttemptCount >= 1) && (
                        <div
                          className={`flex items-start gap-3 relative cursor-pointer transition-all duration-200 ${selectedAttempt === 1 ? 'bg-indigo-50 -mx-4 px-4 py-2 rounded-lg' : 'hover:bg-gray-50 -mx-4 px-4 py-2 rounded-lg'}`}
                          onClick={() => handleAttemptClick(1)}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${selectedAttempt === 1 ? 'bg-indigo-600' : 'bg-indigo-100'}`}>
                            <svg className={`w-4 h-4 transition-colors ${selectedAttempt === 1 ? 'text-white' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium transition-colors ${selectedAttempt === 1 ? 'text-indigo-900' : 'text-gray-900'}`}>Verification Attempt 1</p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(getAttemptTimestamp(1))} - {latestAttemptForHistory === 1 ? 'Current attempt' : 'Previous attempt 1'}
                            </p>
                          </div>
                          {selectedAttempt === 1 && (
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-start gap-3 relative">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center z-10">
                          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Account Created</p>
                          <p className="text-xs text-gray-500">{formatDateTime(user.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile View Documents Button */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 z-[112] p-4 bg-white border-t border-gray-200">
                <button
                  onClick={() => setShowMobileDocs(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-200 hover:bg-blue-100 active:scale-[0.98] transition-all"
                >
                  <FileText className="w-5 h-5" />
                  View Verification Documents
                </button>
              </div>
            </div>

            {/* Right Column - Verification Content - Bottom Sheet on Mobile */}
            <div
              ref={sheetRef}
              className={`
                fixed md:static inset-x-0 bottom-0 z-[120] h-[85vh] md:h-full bg-white 
                md:transform-none rounded-t-2xl md:rounded-none md:flex-1
                shadow-[0_-4px_30px_rgba(0,0,0,0.15)] md:shadow-none flex flex-col
                ${showMobileDocs ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
              `}
            >
              {/* Mobile Sheet Handle */}
              <div
                className="md:hidden flex items-center justify-center p-2 border-b border-gray-100 cursor-pointer touch-none"
                onClick={() => setShowMobileDocs(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1" />
              </div>


              {/* Top Navigation Tabs */}
              <div className="flex-shrink-0 border-y md:border-b md:border-t-0 border-gray-200 bg-gray-50">
                <div className="grid grid-cols-2">
                  <button
                    onClick={() => setActiveTab('face')}
                    className={`px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium transition-colors ${activeTab === 'face'
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    Face Verification
                  </button>
                  <button
                    onClick={() => setActiveTab('credentials')}
                    className={`px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium transition-colors ${activeTab === 'credentials'
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    Certificates/Credentials ({Array.isArray(currentImages.credentials) ? currentImages.credentials.length : 0})
                  </button>
                </div>
              </div>

              {/* Content Area - Images */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                <div className="w-full">
                  {activeTab === 'face' && (
                    <div className="space-y-6 md:space-y-8">
                      {/* Face Verification Images */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Face Verification</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {Array.isArray(currentImages.faceVerification) && currentImages.faceVerification.length > 0 ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Left Side</p>
                                {currentImages.faceVerification[0] ? (
                                  <ClickableImage
                                    key={currentImages.faceVerification[0].cloudinaryUrl}
                                    src={currentImages.faceVerification[0].cloudinaryUrl}
                                    alt="Face Left Side"
                                    className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="face"
                                    title={`Face Verification - Attempt ${selectedAttempt} - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                {currentImages.faceVerification[1] ? (
                                  <ClickableImage
                                    key={currentImages.faceVerification[1].cloudinaryUrl}
                                    src={currentImages.faceVerification[1].cloudinaryUrl}
                                    alt="Face Front"
                                    className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="face"
                                    title={`Face Verification - Attempt ${selectedAttempt} - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Right Side</p>
                                {currentImages.faceVerification[2] ? (
                                  <ClickableImage
                                    key={currentImages.faceVerification[2].cloudinaryUrl}
                                    src={currentImages.faceVerification[2].cloudinaryUrl}
                                    alt="Face Right Side"
                                    className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="face"
                                    title={`Face Verification - Attempt ${selectedAttempt} - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : currentImages.faceVerification && !Array.isArray(currentImages.faceVerification) ? (
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
                                  key={currentImages.faceVerification.cloudinaryUrl}
                                  src={currentImages.faceVerification.cloudinaryUrl}
                                  alt="Face Verification"
                                  className="w-full h-48 object-cover rounded-lg shadow-md bg-gray-100"
                                  imageType="face"
                                  title={`Face Verification - Attempt ${selectedAttempt} - ${user.name}`}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Array.isArray(currentImages.validId) && currentImages.validId.length > 0 ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                {currentImages.validId[0] ? (
                                  <ClickableImage
                                    key={currentImages.validId[0].cloudinaryUrl}
                                    src={currentImages.validId[0].cloudinaryUrl}
                                    alt="ID Front"
                                    className="w-full h-72 md:h-[22rem] object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="id"
                                    title={`Valid ID - Attempt ${selectedAttempt} - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 md:h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Back</p>
                                {currentImages.validId[1] ? (
                                  <ClickableImage
                                    key={currentImages.validId[1].cloudinaryUrl}
                                    src={currentImages.validId[1].cloudinaryUrl}
                                    alt="ID Back"
                                    className="w-full h-72 md:h-[22rem] object-cover rounded-lg shadow-md bg-gray-100"
                                    imageType="id"
                                    title={`Valid ID - Attempt ${selectedAttempt} - ${user.name}`}
                                  />
                                ) : (
                                  <div className="w-full h-48 md:h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">No image</p>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : currentImages.validId && !Array.isArray(currentImages.validId) ? (
                            <>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Front</p>
                                <ClickableImage
                                  key={currentImages.validId.cloudinaryUrl}
                                  src={currentImages.validId.cloudinaryUrl}
                                  alt="Valid ID"
                                  className="w-full h-72 md:h-[22rem] object-cover rounded-lg shadow-md bg-gray-100"
                                  imageType="id"
                                  title={`Valid ID - Attempt ${selectedAttempt} - ${user.name}`}
                                />
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-2">Back</p>
                                <div className="w-full h-48 md:h-64 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
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
                      {currentImages.credentials && currentImages.credentials.length > 0 ? (
                        <div className="pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
                            {currentImages.credentials.map((credential: any, index: number) => (
                              <div key={index} className="w-full">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  {formatCredentialName(credential.originalName || `Credential ${index + 1}`)}
                                </p>
                                <div className="w-full h-[32rem] md:h-[38rem] bg-gray-100 rounded-lg shadow-md flex items-center justify-center">
                                  <ClickableImage
                                    key={credential.cloudinaryUrl}
                                    src={credential.cloudinaryUrl}
                                    alt={formatCredentialName(credential.originalName || `Credential ${index + 1}`)}
                                    className="max-h-full max-w-full object-contain"
                                    imageType="credential"
                                    title={`${formatCredentialName(credential.originalName || `Credential ${index + 1}`)} - Attempt ${selectedAttempt} - ${user.name}`}
                                  />
                                </div>
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

              {/* Actions */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 md:p-6">
                {verification.status === 'pending' || verification.status === 'under_review' || verification.status === 'flagged' ? (
                  <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-2 md:gap-3">
                    <button
                      onClick={handleQuickReject}
                      disabled={updating}
                      className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject & Ban
                    </button>
                    <button
                      onClick={handleRequestResubmission}
                      disabled={updating}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Request Resubmission
                    </button>
                    {verification.status !== 'flagged' && (
                      <button
                        onClick={handleFlagForReview}
                        disabled={updating}
                        className="flex-1 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hidden md:flex"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        Flag for Review
                      </button>
                    )}
                    <button
                      onClick={handleQuickApprove}
                      disabled={updating}
                      className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                ) : verification.status === 'approved' ? (
                  <div className="w-full rounded-lg p-3 bg-green-50 flex items-center justify-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-green-700">Verified and Approved</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default VerificationDetailsModal;
