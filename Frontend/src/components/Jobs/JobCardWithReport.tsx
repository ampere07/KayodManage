import React, { useState } from 'react';
import { Flag, MoreVertical } from 'lucide-react';
import { ReportPost } from '../Report';
import { formatBudgetWithType } from '../../utils/currency';

interface JobCardProps {
  job: {
    _id: string;
    title: string;
    description: string;
    category: string;
    budget: number;
    budgetType: string;
    location: {
      city: string;
      region: string;
    };
    user: {
      name: string;
    };
    createdAt: string;
  };
  currentUserId?: string;
}

// Example integration of ReportPost component in a job card
const JobCardWithReport: React.FC<JobCardProps> = ({ job, currentUserId }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleReportSubmitted = () => {
    console.log(`Report submitted for job: ${job._id}`);
    // You could refresh the job list, show a success message, etc.
  };

  // Don't show report option for own jobs
  const canReport = currentUserId && currentUserId !== job.user._id;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 relative">
      {/* Job Card Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
          <p className="text-gray-600 mb-3">{job.description}</p>
        </div>

        {/* Options Dropdown */}
        {canReport && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowReportModal(true);
                      setShowDropdown(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                  >
                    <Flag className="h-4 w-4 mr-3" />
                    Report this post
                  </button>
                </div>
              </div>
            )}

            {/* Overlay to close dropdown */}
            {showDropdown && (
              <div
                className="fixed inset-0 z-0"
                onClick={() => setShowDropdown(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 mb-4">
        <div>
          <span className="font-medium">Budget:</span> {formatBudgetWithType(job.budget, job.budgetType)}
        </div>
        <div>
          <span className="font-medium">Category:</span> {job.category}
        </div>
        <div>
          <span className="font-medium">Location:</span> {job.location.city}, {job.location.region}
        </div>
        <div>
          <span className="font-medium">Posted by:</span> {job.user.name}
        </div>
      </div>

      {/* Job Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <span className="text-sm text-gray-500">
          Posted {new Date(job.createdAt).toLocaleDateString()}
        </span>
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Apply Now
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Save
          </button>
        </div>
      </div>

      {/* Report Modal */}
      <ReportPost
        jobId={job._id}
        jobTitle={job.title}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={handleReportSubmitted}
      />
    </div>
  );
};

export default JobCardWithReport;