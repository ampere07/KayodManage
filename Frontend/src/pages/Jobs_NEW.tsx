import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  User,
  Wallet,
  Calendar,
  Users,
  X,
  ChevronDown,
  Briefcase,
  FolderOpen,
  DollarSign,
  Archive,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Component imports
import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import { JobDetailsModal } from '../components/Modals';
import ArchiveModal from '../components/Jobs/ArchiveModal';

// Type imports
import type { Job, JobsPagination } from '../types';

// Utility imports
import {
  getInitials,
  getJobStatusColor,
  getJobStatusIcon,
  JOB_CATEGORIES,
  formatPHPCurrency
} from '../utils';

// Hooks
import { useJobs, useJobCounts, useJobMutations } from '../hooks/useJobs';

/**
 * Jobs Management Page
 * Displays and manages all jobs in the system
 */
const Jobs: React.FC = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [urgentFilter, setUrgentFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModal, setJobModal] = useState({ isOpen: false });
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [pagination, setPagination] = useState<JobsPagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const queryParams = useMemo(() => ({
    page: pagination.page,
    limit: pagination.limit,
    ...(searchTerm && { search: searchTerm }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(categoryFilter !== 'all' && { category: categoryFilter }),
    ...(paymentMethodFilter !== 'all' && { paymentMethod: paymentMethodFilter }),
    ...(urgentFilter === 'true' && { isUrgent: 'true' })
  }), [pagination.page, pagination.limit, searchTerm, statusFilter, categoryFilter, paymentMethodFilter, urgentFilter]);

  const { data: jobsData, isLoading } = useJobs(queryParams);
  const { data: jobCounts = { total: 0, open: 0, assigned: 0, completed: 0, totalValue: 0 } } = useJobCounts();
  const mutations = useJobMutations();

  const jobs = jobsData?.jobs || [];
  const loading = isLoading;

  useEffect(() => {
    if (jobsData?.pagination) {
      setPagination(prev => ({
        ...prev,
        total: jobsData.pagination.total || 0,
        pages: jobsData.pagination.pages || 0
      }));
    }
  }, [jobsData]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, statusFilter, categoryFilter, paymentMethodFilter, urgentFilter]);

  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      await mutations.updateJobStatus.mutateAsync({
        jobId,
        status: status as 'open' | 'in_progress' | 'completed' | 'cancelled'
      });
    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  };

  /**
   * Open job details modal
   */
  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setJobModal({ isOpen: true });
  };

  /**
   * Close job details modal
   */
  const closeJobModal = () => {
    setJobModal({ isOpen: false });
    setTimeout(() => setSelectedJob(null), 300);
  };

  /**
   * Format currency with zero decimals
   */
  const formatCurrency = (amount: number) => {
    if (!amount || isNaN(amount)) {
      return '₱0';
    }
    return formatPHPCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).replace('PHP', '₱');
  };

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Manage and monitor all job listings</p>
          </div>
          <button
            onClick={() => setIsArchiveModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Archive className="h-4 w-4" />
            <span>View Archive</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
          <div 
            onClick={() => setStatusFilter('all')}
            className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-600">Total Jobs</span>
              <Briefcase className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-900">{jobCounts.total.toLocaleString()}</p>
          </div>

          <div 
            onClick={() => setStatusFilter('open')}
            className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-green-600">Open Jobs</span>
              <FolderOpen className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-900">{jobCounts.open.toLocaleString()}</p>
          </div>

          <div 
            onClick={() => setStatusFilter('in_progress')}
            className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border border-yellow-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-yellow-600">Assigned Jobs</span>
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-yellow-900">{jobCounts.assigned.toLocaleString()}</p>
          </div>

          <div 
            onClick={() => setStatusFilter('completed')}
            className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-purple-600">Completed</span>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-purple-900">{jobCounts.completed.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-indigo-600">Total Value</span>
              <DollarSign className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-indigo-900">{formatCurrency(jobCounts.totalValue)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium w-full md:w-auto"
          >
            <option value="all">All Categories</option>
            {JOB_CATEGORIES.map(category => (
              <option key={category} value={category} className="capitalize">
                {category}
              </option>
            ))}
          </select>

          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium w-full md:w-auto"
          >
            <option value="all">Payment Method</option>
            <option value="wallet">Wallet</option>
            <option value="cash">Cash</option>
            <option value="xendit">Xendit</option>
          </select>

          <select
            value={urgentFilter}
            onChange={(e) => setUrgentFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium w-full md:w-auto"
          >
            <option value="all">All Priority</option>
            <option value="true">Urgent Only</option>
            <option value="false">Normal Priority</option>
          </select>
        </div>
      </div>

      {/* Content Area - Existing table/card views remain the same */}
      {/* ... rest of the component stays the same ... */}

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
      />

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={jobModal.isOpen}
        onClose={closeJobModal}
        job={selectedJob}
      />
    </div>
  );
};

export default Jobs;
