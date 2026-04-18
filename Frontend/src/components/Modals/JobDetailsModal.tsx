import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  Users,
  Phone,
  Mail,
  CreditCard,
  Hash,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import UserTypeBadge from '../UI/UserTypeBadge';
import { jobsService } from '../../services';
import type { Job, Application } from '../../types/jobs.types';
import { SidebarContext } from '../Layout/Layout';

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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
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

  const handleHideJob = async () => {
    if (!job) return;

    try {
      await jobsService.hideJob(job._id);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job hidden');
      onClose();
    } catch (error) {
      console.error('Failed to hide job:', error);
      toast.error('Failed to hide job');
    }
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

  const handleDeleteJob = async () => {
    if (!job) return;

    if (!confirm('Are you sure you want to delete this job? This will permanently archive it and remove it from the user\'s account.')) {
      return;
    }

    try {
      await jobsService.deleteJob(job._id);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
      toast.success('Job deleted successfully');
      onClose();
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    }
  };

  const handleRestoreJob = async () => {
    if (!job) return;

    if (!confirm('Are you sure you want to restore this job? This will make it visible to the user again.')) {
      return;
    }

    try {
      await jobsService.restoreJob(job._id);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
      toast.success('Job restored successfully');
      onClose();
    } catch (error) {
      console.error('Failed to restore job:', error);
      toast.error('Failed to restore job');
    }
  };

  if (!isOpen || !job) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

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
                  {job.user?.isVerified && <VerificationStatusBadge isVerified={true} size="sm" hideLabel />}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Mail className="h-3 w-3" />
                    <span className="text-[11px] font-medium truncate">{job.user?.email || 'No email'}</span>
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

            {/* Service Attributes Section */}
            <div className="px-6 py-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-px flex-1 bg-gray-100" />
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <Briefcase className="h-3 w-3" />
                  Service Details
                </h5>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-y-8 gap-x-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Posted On</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(job.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Briefcase className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Profession</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 capitalize">
                    {(job.category || '').replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <CreditCard className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Payment</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 capitalize">
                    {job.paymentMethod}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <MapPin className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Region</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {job.user?.barangay || 'N/A'} • {job.user?.city || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-gray-400 mb-3">
                  <MapPin className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Pick-up / Service Location</span>
                </div>
                <p className="text-sm font-bold text-gray-700 leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
                  {job.locationDisplay || 'Location not specified'}
                </p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="overflow-hidden">
                <button
                  onClick={() => setShowMediaAttachments(!showMediaAttachments)}
                  className={`w-full flex items-center justify-between py-2 text-[10px] font-black text-gray-400 hover:text-blue-500 uppercase tracking-[0.2em] transition-colors`}
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
                        <div
                          key={index}
                          className="aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group relative border border-gray-100"
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          <img
                            src={url}
                            alt={`Job media ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-all flex items-center justify-center">
                            <ExternalLink className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5" />
                          </div>
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
                  className={`w-full flex items-center justify-between py-2 text-[10px] font-black text-gray-400 hover:text-emerald-500 uppercase tracking-[0.2em] transition-colors`}
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
            {job.archived && job.archiveType === 'removed' ? (
              <button
                onClick={handleRestoreJob}
                className="flex-1 px-4 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restore Job
              </button>
            ) : job.archived && job.archiveType === 'hidden' ? (
              <>
                <button
                  onClick={handleUnhideJob}
                  className="flex-1 px-4 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Unhide
                </button>
                <button
                  onClick={handleDeleteJob}
                  className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 shadow-md shadow-red-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
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
                    onClick={handleHideJob}
                    className="flex-1 px-4 py-3.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 shadow-md shadow-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <EyeOff className="h-4 w-4" />
                    Hide Job
                  </button>
                )}
                <button
                  onClick={handleDeleteJob}
                  className="flex-1 px-4 py-3.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {job && job.media && job.media.length > 0 && selectedImageIndex !== null && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-[60] transition-opacity"
            onClick={() => setSelectedImageIndex(null)}
          />

          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 bg-black bg-opacity-50 rounded-full"
              aria-label="Close image viewer"
            >
              <X className="w-6 h-6" />
            </button>

            {job.media.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) =>
                      prev === 0 ? job.media.length - 1 : prev! - 1
                    );
                  }}
                  className="absolute left-4 text-white hover:text-gray-300 transition-colors p-3 bg-black bg-opacity-50 rounded-full"
                  aria-label="Previous image"
                >
                  <ChevronDown className="w-6 h-6 rotate-90" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) =>
                      prev === job.media.length - 1 ? 0 : prev! + 1
                    );
                  }}
                  className="absolute right-4 text-white hover:text-gray-300 transition-colors p-3 bg-black bg-opacity-50 rounded-full"
                  aria-label="Next image"
                >
                  <ChevronDown className="w-6 h-6 -rotate-90" />
                </button>
              </>
            )}

            <div className="max-w-7xl max-h-full w-full h-full flex items-center justify-center">
              <img
                src={job.media[selectedImageIndex]}
                alt={`Job media ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">
              {selectedImageIndex + 1} / {job.media.length}
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
};

export default JobDetailsModal;
