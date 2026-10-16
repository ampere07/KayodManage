import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  XCircle,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  Users,
  Phone,
  CreditCard,
  Hash
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import UserTypeBadge from '../UI/UserTypeBadge';
import ClickableImage from '../UI/ClickableImage';
import { jobsService } from '../../services';
import type { Job, Application } from '../../types/jobs.types';
import { SidebarContext } from '../Layout/Layout';
import { formatReleaseWindow, getServiceClass } from '../../constants/serviceClasses';

// ImageKit configuration
const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/9vpn8u272';

/**
 * Convert media URL to ImageKit URL if it has ik: prefix
 * This ensures job attachments are fetched from ImageKit's imageUpload folder
 */
const getImageKitMediaUrl = (url: string): string => {
  if (!url) return '';
  
  // If already a full ImageKit URL, return as-is
  if (url.startsWith(IMAGEKIT_URL_ENDPOINT)) {
    return url;
  }
  
  // If has ik: prefix, convert to full ImageKit URL
  if (url.startsWith('ik:')) {
    const path = url.replace('ik:', '');
    return `${IMAGEKIT_URL_ENDPOINT}${path}`;
  }
  
  // Return original URL (Cloudinary or other)
  return url;
};

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
}

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

/** Destructive actions that route through the shared confirmation sheet. */
type ConfirmKind = 'hide' | 'delete' | 'restore' | 'cancel';

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  isOpen,
  onClose,
  job
}) => {
  const queryClient = useQueryClient();
  const [showMediaAttachments, setShowMediaAttachments] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  // One confirmation sheet drives every destructive action here. The native
  // confirm()/prompt() they used before gave no room to state consequences,
  // and delete could not explain itself at all.
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [confirming, setConfirming] = useState(false);
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

  useEffect(() => {
    if (isOpen && job) {
      fetchApplicants();
    }
  }, [isOpen, job]);

  const fetchApplicants = async () => {
    if (!job) return;

    try {
      setLoadingApplicants(true);
      const data = await jobsService.getJobById(job._id);
      setApplicants(data.applications || []);
    } catch (error) {
      console.error('Failed to fetch applicants:', error);
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleAcceptApplication = async (applicationId: string) => {
    if (!job) return;

    try {
      await jobsService.acceptApplication(job._id, applicationId);
      toast.success('Application accepted');
      fetchApplicants();
    } catch (error) {
      console.error('Failed to accept application:', error);
      toast.error('Failed to accept application');
    }
  };

  const handleRejectApplication = async (applicationId: string) => {
    if (!job) return;

    try {
      await jobsService.rejectApplication(job._id, applicationId);
      toast.success('Application rejected');
      fetchApplicants();
    } catch (error) {
      console.error('Failed to reject application:', error);
      toast.error('Failed to reject application');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const closeConfirm = () => {
    if (confirming) return;
    setConfirmKind(null);
    setConfirmReason("");
  };

  const handleUnhideJob = async () => {
    if (!job) return;
    try {
      await jobsService.unhideJob(job._id);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job unhidden');
      onClose();
    } catch (error) {
      console.error('Failed to unhide job:', error);
      toast.error('Failed to unhide job');
    }
  };

  /**
   * What each destructive action does and how it has to be confirmed. Keeping
   * them in one table means the sheet below is written once, and a new action
   * is a config entry rather than another copy of the markup.
   */
  const confirmConfig = !job || !confirmKind
    ? null
    : ({
        hide: {
          title: 'Hide this job?',
          confirmLabel: 'Hide job',
          busyLabel: 'Hiding…',
          reasonRequired: false,
          tone: 'amber' as const,
          consequences: [
            'The job stops appearing in search and browse for everyone.',
            'The client keeps it in their account, and you can unhide it later.',
          ],
          run: async () => {
            await jobsService.hideJob(job._id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('Job hidden');
          },
          errorMessage: 'Failed to hide job',
        },
        delete: {
          title: 'Delete this job?',
          confirmLabel: 'Delete job',
          busyLabel: 'Deleting…',
          reasonRequired: false,
          tone: 'red' as const,
          consequences: [
            'The job is archived and removed from the client’s account.',
            'Any applicants lose access to it.',
            'It can be restored from Archived Jobs.',
          ],
          run: async () => {
            await jobsService.deleteJob(job._id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
            toast.success('Job deleted successfully');
          },
          errorMessage: 'Failed to delete job',
        },
        restore: {
          title: 'Restore this job?',
          confirmLabel: 'Restore job',
          busyLabel: 'Restoring…',
          reasonRequired: false,
          tone: 'amber' as const,
          consequences: ['The job becomes visible to the client again.'],
          run: async () => {
            await jobsService.restoreJob(job._id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
            toast.success('Job restored successfully');
          },
          errorMessage: 'Failed to restore job',
        },
        cancel: {
          title: 'Cancel this job?',
          confirmLabel: 'Cancel job & refund',
          busyLabel: 'Cancelling…',
          // The only one that moves money, so the only one that demands a
          // written reason for the audit log.
          reasonRequired: true,
          tone: 'red' as const,
          consequences: [
            `Any payment still held is refunded to the client in full${
              job.budget ? ` (up to ${formatCurrency(job.budget)})` : ''
            }.`,
            'An active dispute is closed as “client refunded”.',
            'Both parties are notified. This cannot be undone.',
          ],
          run: async (reason: string) => {
            const result = await jobsService.forceCancelJob(job._id, reason);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
            toast.success(
              result.refundedAmount > 0
                ? `Job cancelled — ₱${result.refundedAmount} refunded to client`
                : 'Job cancelled successfully'
            );
          },
          errorMessage: 'Failed to cancel job',
        },
      }[confirmKind]);

  const runConfirmedAction = async () => {
    if (!confirmConfig || confirming) return;
    const reason = confirmReason.trim();
    if (confirmConfig.reasonRequired && !reason) return;

    setConfirming(true);
    try {
      await confirmConfig.run(reason);
      onClose();
    } catch (error: any) {
      console.error(confirmConfig.errorMessage, error);
      toast.error(error?.response?.data?.error || confirmConfig.errorMessage);
    } finally {
      setConfirming(false);
      setConfirmKind(null);
      setConfirmReason("");
    }
  };

  if (!isOpen || !job) return null;


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Job ID copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy Job ID');
    });
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[90] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full md:w-[550px] bg-gray-50 z-[100] shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-lg font-black text-gray-900 truncate leading-tight">
                  {job.title}
                </h3>
                <div className="flex-shrink-0 flex gap-1 transform scale-[0.85] origin-left">
                  <VerificationStatusBadge isVerified={job.user?.isVerified || false} />
                  <UserTypeBadge userType={job.user?.userType || 'client'} />
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(job._id)}
                className="flex items-center gap-1.5 group"
                title="Click to copy Job ID"
              >
                <span className="text-[10px] font-mono font-bold text-gray-400 group-hover:text-blue-600 transition-colors">
                  ID: {job._id}
                </span>
                <span className="text-[8px] font-black text-gray-300 group-hover:text-blue-500 uppercase tracking-tighter transition-colors">
                  • Click to Copy
                </span>
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="p-0">
            {/* User Quick Profile - No Container */}
            <div className="px-6 py-6 flex items-center gap-4">
              {job.user?.profileImage ? (
                <div className="relative">
                  <img
                    src={job.user.profileImage}
                    alt={job.user.name}
                    className="w-14 h-14 rounded-full object-cover border border-gray-100"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="text-xl font-black text-blue-600">
                    {getInitials(job.user?.name || 'U')}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-base font-black text-gray-900 truncate">{job.user?.name || 'Unknown User'}</h4>
                  {job.user?.isVerified && <VerificationStatusBadge isVerified={true} size="sm" />}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Phone className="h-3 w-3" />
                    <span className="text-[11px] font-medium truncate">{job.user?.phoneNumber || job.user?.phone || 'No phone number'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Hash className="h-3 w-3" />
                    <span className="text-[10px] font-bold">KYD: {job.user?._id?.slice(-8).toUpperCase() || '00000000'}</span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <UserTypeBadge userType={job.user?.userType || 'client'} />
              </div>
            </div>

            {/* Job Title and Description */}
            <div className="px-6 py-4 border-y border-gray-100">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 text-gray-900 mb-1">
                    <Briefcase className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Job Title</span>
                  </div>
                  <p className="text-base font-medium text-gray-600 leading-tight">
                    {job.title}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-900 mb-1">
                    <Hash className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Job Details</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600 leading-relaxed">
                    {job.description || 'No description provided'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-y border-gray-100">
              <div className="px-6 py-6 bg-indigo-50/20 border-r border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-3 w-3 text-indigo-500" />
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Budget</span>
                </div>
                <p className="text-xl font-black text-indigo-900">
                  {job.budget ? formatCurrency(job.budget) : 'Unset'}
                </p>
              </div>
              
              <div className="px-6 py-6 bg-emerald-50/20">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-3 w-3 text-emerald-500" />
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Applicants</span>
                </div>
                <p className="text-xl font-black text-emerald-900">
                  {job.applicationCount || 0}
                </p>
              </div>
            </div>

            {(job.completionStatus?.dispute?.isActive ||
              job.cancellation?.reason ||
              (job.escrowStatus && job.escrowStatus !== 'none')) && (
              <>
                <div className="px-6 pt-6 space-y-3">
                  {job.completionStatus?.dispute?.isActive && (
                    <div data-testid="admin-job-active-dispute-banner" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-800 mb-1">
                        Active Dispute — raised by {job.completionStatus.dispute.raisedBy || 'unknown'}
                      </p>
                      <p className="text-sm text-amber-900">{job.completionStatus.dispute.reason || 'No reason given'}</p>
                      {job.completionStatus.dispute.raisedAt && (
                        <p className="text-xs text-amber-700 mt-1">
                          Raised {new Date(job.completionStatus.dispute.raisedAt).toLocaleString('en-US')}
                        </p>
                      )}
                      <p className="text-xs text-amber-700 mt-2">Resolve this from the Support inbox.</p>
                    </div>
                  )}

                  {job.cancellation?.reason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-semibold text-red-800 mb-1">Cancellation</p>
                      <p className="text-sm text-red-900">{job.cancellation.reason}</p>
                      <p className="text-xs text-red-700 mt-1">
                        Fee applied: {job.cancellation.feeApplied ? formatCurrency(job.cancellation.feeApplied) : '₱0'}
                        {job.cancellation.cancelledAt &&
                          ` — ${new Date(job.cancellation.cancelledAt).toLocaleString('en-US')}`}
                      </p>
                    </div>
                  )}

                  {job.escrowStatus && job.escrowStatus !== 'none' && (
                    <div data-testid="admin-job-escrow-card" className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-1">Escrow</p>
                      <p data-testid="admin-job-escrow-status" className="text-sm text-blue-900 capitalize">Status: {job.escrowStatus}</p>
                      {/* The hold length is per-job, snapshotted at booking —
                          an admin deciding a dispute needs the terms this
                          client actually agreed to, not the current category
                          setting, which may since have changed. */}
                      <p data-testid="admin-job-service-class" className="text-xs text-blue-700 mt-1">
                        Terms: {getServiceClass(job.serviceClass).label} · held{' '}
                        {formatReleaseWindow(
                          job.paymentReleaseHours ??
                            getServiceClass(job.serviceClass).paymentReleaseHours,
                        )}
                      </p>
                      {job.escrowReleaseAt && (
                        <p data-testid="admin-job-escrow-release-date" className="text-xs text-blue-700 mt-1">
                          Release date: {new Date(job.escrowReleaseAt).toLocaleString('en-US')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Service Attributes Section */}
            <div className="px-6 py-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-px flex-1 bg-gray-100" />
                <h5 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <Briefcase className="h-3 w-3" />
                  Service Details
                </h5>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-y-8 gap-x-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-900">
                    <Calendar className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Posted On</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">
                    {new Date(job.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-900">
                    <Briefcase className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Profession</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600 capitalize">
                    {(() => {
                      const val = ((job as any).professionName || (job as any).categoryName || job.category || '').trim();
                      if (/^[a-fA-F0-9]{24}$/.test(val)) return 'General Service';
                      return val.replace(/([A-Z])/g, ' $1').trim();
                    })()}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-900">
                    <CreditCard className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Payment</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600 capitalize">
                    {job.paymentMethod}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-gray-900 mb-3">
                  <MapPin className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Job Location</span>
                </div>
                <p className="text-sm font-medium text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
                  {(() => {
                    const loc = job.location;
                    if (!loc) return 'Location not specified';
                    
                    if (typeof loc === 'string') return loc;
                    
                    if (typeof loc === 'object') {
                      const parts = [
                        loc.address,
                        loc.city,
                        loc.country
                      ].filter(Boolean);
                      
                      return parts.length > 0 ? parts.join(', ') : 'Location not specified';
                    }
                    
                    return 'Location not specified';
                  })()}
                </p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="overflow-hidden">
                <button
                  onClick={() => setShowMediaAttachments(!showMediaAttachments)}
                  className={`w-full flex items-center justify-between py-2 text-[10px] font-black text-gray-900 hover:text-blue-500 uppercase tracking-[0.2em] transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    <span>Media Attachments ({job.media?.length || 0})</span>
                  </div>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${showMediaAttachments ? 'rotate-180' : ''}`} />
                </button>

                {showMediaAttachments && (
                  <div className="pt-4 grid grid-cols-2 gap-3">
                    {job.media && job.media.length > 0 ? (
                      job.media.map((url, index) => (
                        <div key={index} className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                          <ClickableImage
                            src={getImageKitMediaUrl(url)}
                            alt={`Job media ${index + 1}`}
                            className="w-full h-full object-cover"
                            imageType="credential"
                            title={`Job media ${index + 1}`}
                            modalClassName="md:right-[550px]"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-4 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                        No attachments
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-50" />

              <div className="overflow-hidden">
                <button
                  onClick={() => setShowApplicants(!showApplicants)}
                  className={`w-full flex items-center justify-between py-2 text-[10px] font-black text-gray-900 hover:text-emerald-500 uppercase tracking-[0.2em] transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>Applicants ({applicants.length})</span>
                  </div>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${showApplicants ? 'rotate-180' : ''}`} />
                </button>

                {showApplicants && (
                  <div className="mt-4">
                    {loadingApplicants ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    ) : applicants.length > 0 ? (
                      <div className="space-y-3">
                      {applicants.map((application) => (
                        <div
                          key={application._id}
                          className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-semibold text-blue-700">
                                  {getInitials(application.provider?.name || 'P')}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {application.provider?.name || 'Unknown Provider'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {application.provider?.email || 'No email'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${application.status === 'accepted'
                                ? 'bg-green-100 text-green-700'
                                : application.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}
                            >
                              {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                            </span>
                          </div>

                          {application.provider?.phone && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-500">Phone:</p>
                              <p className="text-sm text-gray-900">{application.provider.phone}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                              Applied {formatDistanceToNow(new Date(application.appliedAt), { addSuffix: true })}
                            </p>
                            {application.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAcceptApplication(application._id)}
                                  className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRejectApplication(application._id)}
                                  className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      No applicants yet
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 p-6 bg-white flex-shrink-0">
          <div className="flex gap-3">
            {job.isDeleted ? (
              <button
                onClick={() => setConfirmKind('restore')}
                className="flex-1 px-4 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restore Job
              </button>
            ) : (
              <>
                {job.isHidden ? (
                  <button
                    onClick={handleUnhideJob}
                    className="flex-1 px-4 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Unhide
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmKind('hide')}
                    className="flex-1 px-4 py-3.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 shadow-md shadow-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <EyeOff className="h-4 w-4" />
                    Hide Job
                  </button>
                )}
                <button
                  onClick={() => setConfirmKind('delete')}
                  className="flex-1 px-4 py-3.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>
          {!job.isHidden && !job.isDeleted && job.status !== 'cancelled' && job.status !== 'completed' && (
            <button
              onClick={() => setConfirmKind('cancel')}
              className="w-full mt-3 px-4 py-3 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              data-testid="admin-force-cancel-job-btn"
            >
              <XCircle className="h-4 w-4" />
              Cancel Job (release held payment)
            </button>
          )}
        </div>
      </div>

      {/* One confirmation sheet for hide / delete / restore / cancel. Docked to
          the bottom of this panel rather than centred on screen: the action
          belongs to the job on show, so it stays in the job's own column and
          leaves the ticket behind it readable. Scrim and sheet are clipped to
          the panel's width so nothing spills over the chat. */}
      {confirmConfig && (
        <>
          <div
            className="fixed inset-y-0 right-0 z-[200] w-full bg-black/40 md:w-[550px]"
            onClick={closeConfirm}
          />
          <div className="fixed bottom-0 right-0 z-[201] w-full md:w-[550px]">
            <div className="rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl">
              <div className="flex justify-center pt-2.5">
                <span className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <div className="flex items-start gap-3 px-5 pb-4 pt-3">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    confirmConfig.tone === 'red' ? 'bg-red-50' : 'bg-amber-50'
                  }`}
                >
                  <XCircle
                    className={`h-5 w-5 ${
                      confirmConfig.tone === 'red' ? 'text-red-600' : 'text-amber-600'
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900">
                    {confirmConfig.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    &ldquo;{job.title}&rdquo;
                  </p>
                </div>
              </div>

              <div className="space-y-3 px-5">
                <ul
                  className={`space-y-1.5 rounded-xl p-3 text-[12px] leading-relaxed ${
                    confirmConfig.tone === 'red'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {confirmConfig.consequences.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>

                {confirmConfig.reasonRequired && (
                  <div>
                    <label
                      htmlFor="confirm-reason"
                      className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500"
                    >
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="confirm-reason"
                      data-testid="force-cancel-reason"
                      value={confirmReason}
                      onChange={(e) => setConfirmReason(e.target.value)}
                      rows={3}
                      autoFocus
                      disabled={confirming}
                      placeholder="Why is this job being cancelled? Both parties will see this."
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                    />
                    {!confirmReason.trim() && (
                      <p className="mt-1 text-[11px] font-medium text-amber-700">
                        A reason is required — it goes in the activity log.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* pb clears the home indicator on gesture-nav devices. */}
              <div className="flex gap-2 px-5 pb-6 pt-4">
                <button
                  onClick={closeConfirm}
                  disabled={confirming}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  Keep job
                </button>
                <button
                  data-testid="confirm-destructive-action"
                  onClick={runConfirmedAction}
                  disabled={
                    confirming ||
                    (confirmConfig.reasonRequired && !confirmReason.trim())
                  }
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    confirmConfig.tone === 'red'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {confirming ? confirmConfig.busyLabel : confirmConfig.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
};

export default JobDetailsModal;
