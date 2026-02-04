import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,

  CheckCircle,
  Clock,
  MapPin,
  Wallet,
  Calendar,
  Users,
  X,
  ChevronDown,
  Briefcase,
  FolderOpen,
  DollarSign,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Component imports
import { JobDetailsModal } from '../components/Modals';

// Tpye imports
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
import { useSocket as useSocketContext } from '../context/SocketContext';

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

  const queryClient = useQueryClient();
  const { socket } = useSocketContext();
  const { data: jobsData, isLoading } = useJobs(queryParams);
  const { data: jobCounts = { total: 0, open: 0, assigned: 0, completed: 0, totalValue: 0 } } = useJobCounts();
  const mutations = useJobMutations();

  const jobs = jobsData?.jobs || [];
  const loading = isLoading;

  useEffect(() => {
    if (!socket) return;

    const handleJobUpdate = (data: any) => {
      console.log('Job updated via socket:', data);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      if (data.updateType === 'hidden') {
        toast.success('Job has been hidden');
      } else if (data.updateType === 'unhidden') {
        toast.success('Job has been restored');
      }
    };

    socket.on('job:updated', handleJobUpdate);

    return () => {
      socket.off('job:updated', handleJobUpdate);
    };
  }, [socket, queryClient]);

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
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-gray-50 -mx-2 sm:-mx-4 md:-mx-8 lg:-mx-8 -my-2 sm:-my-3 md:-my-4">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Manage and monitor all job listings</p>
          </div>
        </div>

        {/* Stats Counters */}
        <div className="mb-4">
          {/* Mobile: Compact Grid */}
          {/* Mobile: Compact Grid */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            <div
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-blue-50 border-blue-200 ${statusFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-300' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Total Jobs</span>
              </div>
              <span className="text-sm font-bold text-blue-700">{jobCounts.total}</span>
            </div>

            <div
              onClick={() => setStatusFilter('open')}
              className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-green-50 border-green-200 ${statusFilter === 'open' ? 'border-green-400 ring-2 ring-green-300' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Open</span>
              </div>
              <span className="text-sm font-bold text-green-700">{jobCounts.open}</span>
            </div>

            <div
              onClick={() => setStatusFilter('in_progress')}
              className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-yellow-50 border-yellow-200 ${statusFilter === 'in_progress' ? 'border-yellow-400 ring-2 ring-yellow-300' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-700">Assigned</span>
              </div>
              <span className="text-sm font-bold text-yellow-700">{jobCounts.assigned}</span>
            </div>

            <div
              onClick={() => setStatusFilter('completed')}
              className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-purple-50 border-purple-200 ${statusFilter === 'completed' ? 'border-purple-400 ring-2 ring-purple-300' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Done</span>
              </div>
              <span className="text-sm font-bold text-purple-700">{jobCounts.completed}</span>
            </div>

            <div className="col-span-2 rounded-lg p-2.5 border border-indigo-200 bg-indigo-50 flex items-center justify-center gap-2">
              <DollarSign className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">Total Value:</span>
              <span className="text-sm font-bold text-indigo-700">{formatCurrency(jobCounts.totalValue)}</span>
            </div>
          </div>

          {/* Desktop: Grid Layout */}
          <div className="hidden md:grid grid-cols-5 gap-3">
            <div
              onClick={() => setStatusFilter('all')}
              className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${statusFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-300' : 'border-blue-200'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600">Total Jobs</span>
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">{jobCounts.total.toLocaleString()}</p>
            </div>

            <div
              onClick={() => setStatusFilter('open')}
              className={`bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${statusFilter === 'open' ? 'border-green-400 ring-2 ring-green-300' : 'border-green-200'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-green-600">Open Jobs</span>
                <FolderOpen className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">{jobCounts.open.toLocaleString()}</p>
            </div>

            <div
              onClick={() => setStatusFilter('in_progress')}
              className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${statusFilter === 'in_progress' ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-yellow-200'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-yellow-600">Assigned Jobs</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-900">{jobCounts.assigned.toLocaleString()}</p>
            </div>

            <div
              onClick={() => setStatusFilter('completed')}
              className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${statusFilter === 'completed' ? 'border-purple-400 ring-2 ring-purple-300' : 'border-purple-200'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-purple-600">Completed</span>
                <CheckCircle className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">{jobCounts.completed.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-indigo-600">Total Value</span>
                <DollarSign className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-indigo-900">{formatCurrency(jobCounts.totalValue)}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 md:flex gap-2 md:gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 md:px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs md:text-sm font-medium"
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
              className="px-2 md:px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs md:text-sm font-medium"
            >
              <option value="all">Payment Method</option>
              <option value="wallet">Wallet</option>
              <option value="cash">Cash</option>
              <option value="xendit">Xendit</option>
            </select>

            <select
              value={urgentFilter}
              onChange={(e) => setUrgentFilter(e.target.value)}
              className="px-2 md:px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs md:text-sm font-medium"
            >
              <option value="all">All Priority</option>
              <option value="true">Urgent Only</option>
              <option value="false">Normal Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading jobs...</p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No jobs found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white">
                <table className="min-w-full w-full table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="w-[25%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Job Title
                      </th>
                      <th className="w-[20%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="w-[15%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Budget
                      </th>
                      <th className="w-[15%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="w-[12%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Applications
                      </th>
                      <th className="w-[13%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Posted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {jobs.map((job, index) => (
                      <React.Fragment key={job._id}>
                        <tr
                          onClick={() => openJobModal(job)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                                {job.isUrgent && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                    Urgent
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1">{job.description}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {job.user?.profileImage ? (
                                <img
                                  src={job.user.profileImage}
                                  alt={job.user.name}
                                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-gray-700">
                                    {getInitials(job.user?.name || 'Unknown')}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {job.user?.name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {job.user?.email || 'No email'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(job.budget)}</p>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Wallet className="h-3 w-3" />
                                <span className="capitalize">{job.paymentMethod}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getJobStatusColor(job.status)}`}>
                                {getJobStatusIcon(job.status)}
                                <span className="capitalize">{job.status.replace('_', ' ')}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-semibold text-gray-900">{job.applicationCount || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Calendar className="h-3 w-3" />
                                {new Date(job.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {index < jobs.length - 1 && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="border-b border-gray-200" />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden px-4 py-4 space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job._id}
                    onClick={() => openJobModal(job)}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    {/* Header: User Info & Status */}
                    <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {job.user?.profileImage ? (
                          <img
                            src={job.user.profileImage}
                            alt={job.user.name}
                            className="h-10 w-10 rounded-full object-cover border border-white shadow-sm"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center border border-white shadow-sm">
                            <span className="text-xs font-bold">
                              {getInitials(job.user?.name || 'Unknown')}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">
                            {job.user?.name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {job.user?.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-xs font-bold text-gray-700 bg-gray-200/50 px-2 py-0.5 rounded capitalize">
                          {(job.category || '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getJobStatusColor(job.status)}`}>
                          {job.isUrgent && <span className="text-orange-600 mr-1">⚠️</span>}
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Job Details: Title, Description, Price */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Job Title:</p>
                          <h3 className="text-sm font-bold text-gray-900 truncate">{job.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Budget:</p>
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(job.budget)}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Description:</p>
                        <p className="text-xs text-gray-900 line-clamp-2 leading-relaxed">{job.description}</p>
                      </div>
                    </div>

                    {/* Meta: Dates & Location */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Job Date:</p>
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {new Date(job.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Date Created:</p>
                          <p className="text-xs font-medium text-gray-900">
                            {new Date(job.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Location:</p>
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {job.locationDisplay || 'Location not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Additional Info: Applicants, Payment, Tier */}
                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-700">Applicants</p>
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">{job.applicationCount || 0}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-700">Payment Method</p>
                        <span className="text-xs bg-white border px-1.5 py-0.5 rounded capitalize text-gray-700">{job.paymentMethod}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-700">Service Tier</p>
                        <span className="text-xs bg-white border px-1.5 py-0.5 rounded capitalize text-gray-700">{job.serviceTier}</span>
                      </div>
                    </div>


                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700 text-center md:text-left">
                        Showing{' '}
                        <span className="font-medium">
                          {((pagination.page - 1) * pagination.limit) + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, pagination.total)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{pagination.total}</span> results
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.pages}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={jobModal.isOpen}
        onClose={closeJobModal}
        job={selectedJob}
      />

      {/* Image Lightbox Modal */}
      {selectedJob && selectedJob.media && selectedJob.media.length > 0 && selectedImageIndex !== null && (
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

            {selectedJob.media.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) =>
                      prev === 0 ? selectedJob.media.length - 1 : prev! - 1
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
                      prev === selectedJob.media.length - 1 ? 0 : prev! + 1
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
                src={selectedJob.media[selectedImageIndex]}
                alt={`Job media ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">
              {selectedImageIndex + 1} / {selectedJob.media.length}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Jobs;
