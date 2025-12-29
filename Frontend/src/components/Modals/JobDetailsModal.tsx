import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import UserTypeBadge from '../UI/UserTypeBadge';
import { jobsService } from '../../services';
import type { Job, Application } from '../../types/jobs.types';

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  onJobUpdate?: (updatedJob: Job) => void;
}

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  job,
  onJobUpdate 
}) => {
  const [showMediaAttachments, setShowMediaAttachments] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
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
      toast.success('Job hidden');
      onClose();
    } catch (error) {
      console.error('Failed to hide job:', error);
      toast.error('Failed to hide job');
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }
    
    try {
      await jobsService.deleteJob(job._id);
      toast.success('Job deleted');
      onClose();
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
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

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed right-0 top-0 h-full w-full md:w-[550px] bg-gray-50 z-50 shadow-2xl flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
                <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="Close modal"
                >
                <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <button
                    onClick={() => copyToClipboard(job._id)}
                    className="text-xs text-gray-500 hover:text-blue-600 cursor-pointer transition-colors text-left"
                    title="Click to copy"
                  >
                    Job ID: {job._id}
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 inline">Job Title: </p>
                  <p className="text-base font-semibold text-gray-900 inline">{job.title}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div className="flex items-center gap-4 pb-6">
              {job.user?.profileImage ? (
                <img
                  src={job.user.profileImage}
                  alt={job.user.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-gray-700">
                    {getInitials(job.user?.name || 'U')}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-900 mb-1">{job.user?.name || 'Unknown User'}</h4>
                {(job.user?.firstName || job.user?.lastName) && (
                  <p className="text-sm text-gray-600 mb-1">
                    {job.user?.firstName || ''} {job.user?.lastName || ''}
                  </p>
                )}
                <p className="text-sm text-gray-600 inline">Email: </p>
                <p className="text-sm text-gray-900 inline">{job.user?.email || 'No email'}</p>
                <p className="text-sm text-gray-900 mt-1">KYD:{job.user?._id?.slice(-6) || '000000'}</p>
              </div>
              <div className="flex flex-col gap-2">
                <VerificationStatusBadge isVerified={job.user?.isVerified || false} />
                <UserTypeBadge userType={job.user?.userType || 'client'} />
              </div>
            </div>

            <div className="border-t border-gray-300 -mx-6" />
            <div className="flex -mx-6">
              <div className="flex-1 py-6 px-6">
                <p className="text-base font-semibold text-gray-900 mb-2">Budget:</p>
                <p className="text-base text-gray-700">{job.budget ? formatCurrency(job.budget) : 'Not specified'}</p>
              </div>
              <div className="border-l border-gray-300 flex-1 py-6 pl-4 pr-6">
                <p className="text-base font-semibold text-gray-900 mb-2">Applicants:</p>
                <p className="text-base text-gray-700">{job.applicationCount || 0}</p>
              </div>
            </div>
            <div className="border-t border-gray-300 -mx-6" />

            <div className="mb-6 mt-6">
              <p className="text-base font-semibold text-gray-900 mb-3">Contact Information:</p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Address</p>
                  <p className="text-sm text-gray-900">{job.locationDisplay || 'Location not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Brgy#</p>
                  <p className="text-sm text-gray-900">{job.user?.barangay || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">City</p>
                  <p className="text-sm text-gray-900">{job.user?.city || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone #</p>
                  <p className="text-sm text-gray-900">{job.user?.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Job Posted On:</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(job.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Category:</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{job.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Budget:</p>
                <p className="text-sm font-medium text-gray-900">{job.budget ? formatCurrency(job.budget) : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Method:</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{job.paymentMethod}</p>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div>
              <button
                onClick={() => setShowMediaAttachments(!showMediaAttachments)}
                className="w-full flex items-center justify-between text-base font-semibold text-gray-900 mb-3 hover:text-gray-700 transition-colors"
              >
                <span>Media Attachments ({job.media && job.media.length > 0 ? job.media.length : 0})</span>
                {showMediaAttachments ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              
              {showMediaAttachments && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {job.media && job.media.length > 0 ? (
                    job.media.map((url, index) => (
                      <div 
                        key={index} 
                        className="aspect-video border border-gray-300 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group relative"
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img
                          src={url}
                          alt={`Job media ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                          <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-sm text-gray-500">
                      No media attachments
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-300 mb-6 mt-6 -mx-6" />

            <div>
              <button
                onClick={() => setShowApplicants(!showApplicants)}
                className="w-full flex items-center justify-between text-base font-semibold text-gray-900 mb-3 hover:text-gray-700 transition-colors"
              >
                <span>Applicants ({applicants.length})</span>
                {showApplicants ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              
              {showApplicants && (
                <div className="mt-3">
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
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                application.status === 'accepted'
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

        <div className="border-t border-gray-300 p-6 bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={handleHideJob}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Hide
            </button>
            <button
              onClick={handleDeleteJob}
              className="flex-1 px-4 py-3 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default JobDetailsModal;
