import React, { useState } from 'react';
import {
  AlertTriangle,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  Video,
  Ban,
  Users,
  Shield,
  Clock,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import SideModal from '../SideModal';
import type { ReportedPost } from '../../types/alerts.types';
import { formatBudgetWithType } from '../../utils/currency';

interface ReviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedPost: ReportedPost | null;
  onReview: (postId: string, action: 'approve' | 'dismiss' | 'delete' | 'ban') => Promise<void>;
  isLoading: boolean;
  reportType?: string;
  reportedUserInfo?: {
    _id: string;
    name: string;
    email: string;
    userType?: string;
  } | null;
  onUserAction?: (userId: string, actionType: 'restrict' | 'suspend' | 'ban' | 'delete', duration?: number, reason?: string) => Promise<void>;
}

const ReviewReportModal: React.FC<ReviewReportModalProps> = ({
  isOpen,
  onClose,
  reportedPost,
  onReview,
  isLoading,
  reportType,
  reportedUserInfo,
  onUserAction
}) => {
  const [adminNotes, setAdminNotes] = useState('');
  const [confirmingAction, setConfirmingAction] = useState<'restrict' | 'suspend' | 'ban' | 'delete' | null>(null);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [actionReason, setActionReason] = useState<string>('');

  // Update admin notes when modal opens with a new post
  React.useEffect(() => {
    if (reportedPost) {
      setAdminNotes(reportedPost.adminNotes || '');
    }
  }, [reportedPost]);

  // Reset action state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setConfirmingAction(null);
      setDurationDays(0);
      setDurationHours(0);
      setDurationMinutes(0);
      setActionReason('');
    }
  }, [isOpen]);

  const handleActionClick = (actionType: 'restrict' | 'suspend' | 'ban' | 'delete') => {
    setConfirmingAction(actionType);
  };

  const handleConfirmAction = async () => {
    if (!confirmingAction || !reportedUserInfo?._id || !onUserAction) return;

    const totalDays = durationDays + (durationHours / 24) + (durationMinutes / (24 * 60));

    if (confirmingAction !== 'delete' && totalDays <= 0) {
      toast.error('Please enter a duration');
      return;
    }

    if (!actionReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    await onUserAction(
      reportedUserInfo._id,
      confirmingAction,
      confirmingAction === 'delete' ? undefined : totalDays,
      actionReason
    );

    // Also resolve the report
    if (reportedPost) {
      await onReview(reportedPost._id, 'dismiss');
    }

    setConfirmingAction(null);
    setDurationDays(0);
    setDurationHours(0);
    setDurationMinutes(0);
    setActionReason('');
  };

  const handleCancelAction = () => {
    setConfirmingAction(null);
    setDurationDays(0);
    setDurationHours(0);
    setDurationMinutes(0);
    setActionReason('');
  };

  const getActionLabel = () => {
    switch (confirmingAction) {
      case 'ban': return 'Ban';
      case 'suspend': return 'Suspend';
      case 'restrict': return 'Restrict';
      case 'delete': return 'Delete';
      default: return '';
    }
  };

  const isUserReport = reportType === 'user';

  const handleReview = async (action: 'approve' | 'dismiss' | 'delete' | 'ban') => {
    if (!reportedPost) return;
    await onReview(reportedPost._id, action);
    setAdminNotes('');
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      reviewed: 'bg-blue-100 text-blue-800 border border-blue-200',
      resolved: 'bg-green-100 text-green-800 border border-green-200',
      dismissed: 'bg-gray-100 text-gray-800 border border-gray-200'
    };

    return badges[status as keyof typeof badges] || badges.pending;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatReason = (reason: string) => {
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!reportedPost) return null;

  const jobInfo =
    (typeof reportedPost.jobId === 'object' && reportedPost.jobId) ||
    (reportedPost as any).jobDetails || {};

  const jobIdRef =
    jobInfo._id || jobInfo.jobId || (typeof reportedPost.jobId === 'string' ? reportedPost.jobId : '') || '';
  const jobTitle = jobInfo.title || 'Untitled';
  const jobDescription = jobInfo.description || 'No description';
  const jobCategory = jobInfo.category || 'N/A';
  const jobBudget = jobInfo.budget ?? 0;
  const jobBudgetType = jobInfo.budgetType || 'fixed';
  const jobPaymentMethod = jobInfo.paymentMethod || 'Not specified';
  const jobLocation = jobInfo.location || { address: 'Not specified', city: 'Not specified' };

  return (
    <SideModal
      isOpen={isOpen}
      onClose={onClose}
      title={isUserReport ? 'Review User Report' : 'Review Reported Post'}
      width="2xl"
    >
      <div className="flex flex-col relative pb-32">
        {/* User Details (for user reports) */}
        {isUserReport ? (
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900">Reported User</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(reportedPost.status)}`}>
                {reportedPost.status.charAt(0).toUpperCase() + reportedPost.status.slice(1)}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">User ID:</span>
                <span className="col-span-2 font-mono text-blue-600 font-semibold">
                  {reportedUserInfo?._id ? `#${reportedUserInfo._id.slice(-6).toUpperCase()}` : 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Name:</span>
                <span className="col-span-2 text-gray-900">{reportedUserInfo?.name || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Email:</span>
                <span className="col-span-2 text-gray-900">{reportedUserInfo?.email || 'N/A'}</span>
              </div>
              {reportedUserInfo?.userType && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">User Type:</span>
                  <span className="col-span-2 text-gray-900 capitalize">{reportedUserInfo.userType}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Job Details (for job/post reports) */
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900">Job Details</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(reportedPost.status)}`}>
                {reportedPost.status.charAt(0).toUpperCase() + reportedPost.status.slice(1)}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Job ID:</span>
                <span className="col-span-2 font-mono text-blue-600 font-semibold">
                  {jobIdRef ? `#${jobIdRef.slice(-6).toUpperCase()}` : 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Title:</span>
                <span className="col-span-2 text-gray-900">{jobTitle}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Description:</span>
                <span className="col-span-2 text-gray-900">{jobDescription}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Category:</span>
                <span className="col-span-2 text-gray-900">{jobCategory}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Budget:</span>
                <span className="col-span-2 text-gray-900">
                  {formatBudgetWithType(jobBudget, jobBudgetType)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Payment:</span>
                <span className="col-span-2 text-gray-900">{jobPaymentMethod}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Location:</span>
                <span className="col-span-2 text-gray-900">
                  {jobLocation?.address || 'N/A'}{jobLocation?.city ? `, ${jobLocation.city}` : ''}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-600 font-medium">Posted:</span>
                <span className="col-span-2 text-gray-900">{reportedPost.jobId?.createdAt ? formatDate(reportedPost.jobId.createdAt as any) : 'N/A'}</span>
              </div>
              {reportedPost.jobId.isDeleted && (
                <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-400 flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800 text-sm font-medium">This job has been deleted</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200"></div>

        {/* Job Media (only for non-user reports) */}
        {!isUserReport && (
          <>
            <div className="px-6 py-6">
              <h3 className="font-semibold text-lg mb-4 text-gray-900">
                Job Media
                {reportedPost.jobId?.media && reportedPost.jobId.media.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({reportedPost.jobId.media.length} file{reportedPost.jobId.media.length !== 1 ? 's' : ''})
                  </span>
                )}
              </h3>

              {reportedPost.jobId?.media && reportedPost.jobId.media.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {reportedPost.jobId.media.map((mediaItem, index) => {
                    const mediaUrl = typeof mediaItem === 'string' ? mediaItem : mediaItem.type;
                    const mediaType = typeof mediaItem === 'string'
                      ? (mediaUrl?.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                      : mediaItem.mediaType || 'image';
                    const fileName = typeof mediaItem === 'string'
                      ? mediaUrl?.split('/').pop() || 'Unknown file'
                      : mediaItem.originalName || 'Unknown file';

                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${mediaType === 'video'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {mediaType === 'video' ? (
                              <><Video className="h-3 w-3 inline mr-1" />Video</>
                            ) : (
                              <><ImageIcon className="h-3 w-3 inline mr-1" />Image</>
                            )}
                          </span>
                        </div>

                        {mediaType === 'image' ? (
                          <img
                            src={mediaUrl}
                            alt={fileName}
                            className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(mediaUrl, '_blank')}
                          />
                        ) : (
                          <video
                            src={mediaUrl}
                            className="w-full h-24 object-cover rounded border"
                            controls
                            preload="metadata"
                          />
                        )}

                        <div className="mt-2">
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No media files</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200"></div>
          </>
        )}

        {/* Report Details */}
        <div className="px-6 py-6">
          <h3 className="font-semibold text-lg mb-4 text-gray-900">Report Details</h3>
          <div className="p-4 border-l-4 border-red-400 bg-red-50 space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Reason:</span>
              <span className="col-span-2 text-gray-900">{formatReason(reportedPost.reason)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Comment:</span>
              <span className="col-span-2 text-gray-900">"{reportedPost.comment}"</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Reported by:</span>
              <span className="col-span-2 text-gray-900">{reportedPost.reportedBy.providerName}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Email:</span>
              <span className="col-span-2 text-gray-900">{reportedPost.reportedBy.providerEmail}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Report Date:</span>
              <span className="col-span-2 text-gray-900">{formatDate(reportedPost.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Admin Notes */}
        {reportedPost.status === 'pending' ? (
          <div className="px-6 py-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Notes
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Add your notes about this review decision..."
            />
          </div>
        ) : reportedPost.adminNotes && (
          <div className="px-6 py-6">
            <h3 className="font-semibold text-lg mb-4 text-gray-900">Admin Notes</h3>
            <div className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded">
              <p className="text-gray-700 text-sm">{reportedPost.adminNotes}</p>
            </div>
          </div>
        )}

        {/* Action Buttons - Fixed at Bottom */}
        {reportedPost.status === 'pending' && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 px-6 py-4 bg-white z-10">
            {isUserReport && onUserAction ? (
              <div className="space-y-4">
                {/* Dismiss button */}
                <button
                  onClick={() => handleReview('dismiss')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss Report
                </button>

                <div className="border-t border-gray-200"></div>

                {/* Action confirmation UI */}
                {confirmingAction ? (
                  <div className="space-y-4">
                    {confirmingAction !== 'delete' && (
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-gray-500 uppercase">Duration for {getActionLabel()}</p>
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
                      </div>
                    )}
                    {confirmingAction === 'delete' && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <p className="text-sm font-bold text-red-600">Warning: This action cannot be undone</p>
                        </div>
                        <p className="text-sm text-red-700">
                          Deleting this user will permanently remove their account from the system.
                        </p>
                      </div>
                    )}
                    <textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder={`Enter reason for ${getActionLabel().toLowerCase()}...`}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelAction}
                        className="flex-1 h-11 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmAction}
                        disabled={isLoading}
                        className="flex-1 h-11 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                      >
                        Confirm {getActionLabel()}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleActionClick('restrict')}
                      disabled={isLoading}
                      className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100 disabled:opacity-50"
                    >
                      <Shield className="w-5 h-5" />
                      Restrict
                    </button>
                    <button
                      onClick={() => handleActionClick('suspend')}
                      disabled={isLoading}
                      className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-100 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
                    >
                      <Clock className="w-5 h-5" />
                      Suspend
                    </button>
                    <button
                      onClick={() => handleActionClick('ban')}
                      disabled={isLoading}
                      className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <Ban className="w-5 h-5" />
                      Ban
                    </button>
                    <button
                      onClick={() => handleActionClick('delete')}
                      disabled={isLoading}
                      className="flex-1 flex flex-col items-center gap-1.5 py-2 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleReview('dismiss')}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </button>
                <button
                  onClick={() => handleReview('approve')}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Keep Post
                </button>
                <button
                  onClick={() => handleReview('delete')}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white z-10">
            <div className="flex items-center justify-center px-6 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 text-sm">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </SideModal>
  );
};

export default ReviewReportModal;
