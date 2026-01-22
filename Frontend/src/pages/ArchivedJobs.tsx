import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search,
  Eye,
  Archive,
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
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import { JobDetailsModal } from '../components/Modals';

import type { Job, JobsPagination } from '../types';

import {
  getInitials,
  getJobStatusColor,
  getJobStatusIcon,
  JOB_CATEGORIES,
  formatPHPCurrency
} from '../utils';

import { useArchivedJobs, useJobCounts, useArchivedJobCounts } from '../hooks/useJobs';
import { useSocket as useSocketContext } from '../context/SocketContext';

const ArchivedJobs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [archiveTypeFilter, setArchiveTypeFilter] = useState<'all' | 'hidden' | 'removed'>('all');
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
    archived: true,
    ...(archiveTypeFilter !== 'all' && { archiveType: archiveTypeFilter })
  }), [pagination.page, pagination.limit, searchTerm, statusFilter, categoryFilter, archiveTypeFilter]);

  const queryClient = useQueryClient();
  const { socket } = useSocketContext();
  const { data: jobsData, isLoading } = useArchivedJobs(queryParams);
  const { data: archivedCounts = { hidden: 0, removed: 0 } } = useArchivedJobCounts();

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
  }, [searchTerm, statusFilter, categoryFilter, archiveTypeFilter]);

  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setJobModal({ isOpen: true });
  };

  const closeJobModal = () => {
    setJobModal({ isOpen: false });
    setTimeout(() => setSelectedJob(null), 300);
  };

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
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Archived Jobs</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">View and manage archived job listings</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div 
            onClick={() => setArchiveTypeFilter(prev => prev === 'hidden' ? 'all' : 'hidden')}
            className={`bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg hover:scale-105 transition-all ${
              archiveTypeFilter === 'hidden' ? 'border-orange-400 ring-2 ring-orange-300' : 'border-orange-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-orange-600">Hidden</span>
              <Archive className="h-4 w-4 text-orange-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-orange-900">{archivedCounts.hidden.toLocaleString()}</p>
          </div>

          <div 
            onClick={() => setArchiveTypeFilter(prev => prev === 'removed' ? 'all' : 'removed')}
            className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg hover:scale-105 transition-all ${
              archiveTypeFilter === 'removed' ? 'border-red-400 ring-2 ring-red-300' : 'border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-red-600">Removed</span>
              <X className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-900">{archivedCounts.removed.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search archived jobs..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium w-full md:w-auto"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading archived jobs...</p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Archive className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No archived jobs found</p>
              <p className="text-sm text-gray-500 mt-1">Archived jobs will appear here</p>
            </div>
          ) : (
            <>
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
                        Archived
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
                                {job.archivedAt ? formatDistanceToNow(new Date(job.archivedAt), { addSuffix: true }) : formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Calendar className="h-3 w-3" />
                                {job.archivedAt ? new Date(job.archivedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date(job.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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

              <div className="md:hidden px-4 py-4 space-y-3">
                {jobs.map((job) => (
                  <div key={job._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">{job.title}</h3>
                            {job.isUrgent && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 flex-shrink-0">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{job.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                              {job.category}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getJobStatusColor(job.status)}`}>
                              {getJobStatusIcon(job.status)}
                              <span className="capitalize">{job.status.replace('_', ' ')}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {job.user?.profileImage ? (
                              <img
                                src={job.user.profileImage}
                                alt={job.user.name}
                                className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-gray-700">
                                  {getInitials(job.user?.name || 'Unknown')}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">
                                {job.user?.name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {job.user?.email || 'No email'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-600 truncate flex-1">
                            {job.locationDisplay || 'Selected Location'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <p className="text-xs font-semibold text-gray-900">
                              {formatCurrency(job.budget)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">{job.applicationCount}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Archive className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-500">
                            Archived {job.archivedAt ? formatDistanceToNow(new Date(job.archivedAt), { addSuffix: true }) : formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 capitalize">{job.paymentMethod}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-500 capitalize">{job.serviceTier} Tier</span>
                        </div>
                        <button
                          onClick={() => openJobModal(job)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

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

      <JobDetailsModal
        isOpen={jobModal.isOpen}
        onClose={closeJobModal}
        job={selectedJob}
      />

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

export default ArchivedJobs;
