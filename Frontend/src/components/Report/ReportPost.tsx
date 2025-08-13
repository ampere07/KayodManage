import React, { useState } from 'react';
import { AlertTriangle, X, Send } from 'lucide-react';

interface ReportPostProps {
  jobId: string;
  jobTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

const ReportPost: React.FC<ReportPostProps> = ({ 
  jobId, 
  jobTitle, 
  isOpen, 
  onClose, 
  onReportSubmitted 
}) => {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportReasons = [
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'spam', label: 'Spam or Repetitive Posting' },
    { value: 'scam_or_fraud', label: 'Scam or Fraudulent Activity' },
    { value: 'misleading_information', label: 'Misleading Information' },
    { value: 'copyright_violation', label: 'Copyright Violation' },
    { value: 'discrimination', label: 'Discrimination' },
    { value: 'harassment', label: 'Harassment or Bullying' },
    { value: 'violence_or_threats', label: 'Violence or Threats' },
    { value: 'adult_content', label: 'Adult Content' },
    { value: 'fake_job_posting', label: 'Fake Job Posting' },
    { value: 'duplicate_posting', label: 'Duplicate Posting' },
    { value: 'other', label: 'Other (Please specify in comments)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim() || !comment.trim()) {
      setError('Please select a reason and provide a comment');
      return;
    }

    if (comment.trim().length < 10) {
      setError('Please provide a more detailed explanation (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/report-post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId,
          reason,
          comment: comment.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to submit report');
      }

      // Success
      alert('Report submitted successfully. Our team will review it shortly.');
      
      // Reset form
      setReason('');
      setComment('');
      
      // Call callback if provided
      if (onReportSubmitted) {
        onReportSubmitted();
      }
      
      // Close modal
      onClose();

    } catch (err) {
      console.error('Error submitting report:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while submitting the report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      setComment('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <h2 className="text-xl font-bold text-gray-900">Report Post</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Job Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Reporting job:</p>
            <p className="font-medium text-gray-900">{jobTitle}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What's wrong with this post? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {reportReasons.map((reasonOption) => (
                <label key={reasonOption.value} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="radio"
                    name="reason"
                    value={reasonOption.value}
                    checked={reason === reasonOption.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-900">{reasonOption.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please provide more details <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="Please explain why you're reporting this post. The more details you provide, the better we can help."
              maxLength={1000}
              disabled={isSubmitting}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                Minimum 10 characters required
              </p>
              <p className="text-xs text-gray-500">
                {comment.length}/1000
              </p>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-amber-800 font-medium mb-1">Important:</p>
                <ul className="text-amber-700 space-y-1">
                  <li>• False reports may result in account restrictions</li>
                  <li>• Reports are reviewed within 24-48 hours</li>
                  <li>• You'll be notified of our decision via email</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim() || !comment.trim() || comment.trim().length < 10}
              className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportPost;