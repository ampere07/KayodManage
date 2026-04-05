import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getProfessionIconByName } from '../constants/categoryIcons';
import {
  Search,
  Archive,
  XCircle,
  MapPin,
  Calendar,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Component imports
import { JobDetailsModal } from '../components/Modals';
import StatsCard from '../components/Dashboard/StatsCard';

// Tpye imports
import type { Job, JobsPagination, JobCategory } from '../types';

// Services
import { settingsService } from '../services';

// Utility imports
import {
  getInitials,
  getJobStatusColor,
  getJobStatusIcon,
  formatPHPCurrency
} from '../utils';

// Hooks
import { useArchivedJobs, useArchivedJobCounts } from '../hooks/useJobs';
import { useSocket as useSocketContext } from '../context/SocketContext';

/**
 * Archived Jobs Management Page
 * Displays and manages hidden or removed jobs
 */
const ArchivedJobs: React.FC = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [archiveTypeFilter, setArchiveTypeFilter] = useState<'all' | 'hidden' | 'removed'>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModal, setJobModal] = useState({ isOpen: false });
  const [pagination, setPagination] = useState<JobsPagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [professionsList, setProfessionsList] = useState<string[]>([]);
  const [iconTimestamp, setIconTimestamp] = useState(Date.now());

  // Resolver logic adapted from Dashboard.tsx for icons parity
  const resolveIconForJob = useMemo(() => (jobCategory: string, jobIcon?: string) => {
    if (!jobCategory) return { imagePath: '/assets/icons/categories/professional-services.png', label: 'General Service' };
    
    // If a direct icon path or URL is provided, use it
    if (jobIcon && (jobIcon.startsWith('http') || jobIcon.includes('.'))) {
      return { 
        imagePath: jobIcon.startsWith('http') ? jobIcon : `/assets/icons/professions/${jobIcon}`,
        label: jobCategory
      };
    }

    const cleanName = jobCategory.trim().toLowerCase();
    const normalizedSearch = cleanName.replace(/[^a-z0-9]/g, '');
    let categoryIconStr = '';
    let iconStr = '';

    // 1. Try to find in fetched categories/professions (with normalization)
    const cat = categories.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch);
    if (cat) {
      categoryIconStr = cat.icon || '';
    } else {
      for (const c of categories) {
        const prof = c.professions?.find(p => {
          const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return pNorm === normalizedSearch || pNorm.includes(normalizedSearch) || normalizedSearch.includes(pNorm);
        });
        if (prof) {
          iconStr = prof.icon || '';
          categoryIconStr = c.icon || '';
          break;
        }
      }
    }

    // 2. Legacy/Fuzzy mapping fallback for known platform variants
    if (!iconStr) {
      const legacyMap: Record<string, string> = {
        'catering': 'custom:catering.webp',
        'painting': 'custom:painter.webp',
        'beauty': 'custom:beauty--personal-care.webp',
        'cleaning': 'custom:house-cleaning.webp',
        'carpentry': 'custom:carpentry-cabinetry.webp',
        'acrefrigeration': 'custom:ac--refrigerator.webp',
        'acref': 'custom:ac--refrigerator.webp',
        'gardening': 'custom:gardening--landscaping.webp',
        'landscaping': 'custom:gardening--landscaping.webp',
        'moving': 'custom:lipat-bahay-mover.webp',
        'delivery': 'custom:delivery.webp',
        'courier': 'custom:delivery.webp',
        'computerrepair': 'custom:computer-technician.webp',
        'itrep': 'custom:computer-technician.webp',
        'automechanic': 'custom:auto-mechanic.webp',
        'automecanic': 'custom:auto-mechanic.webp',
        'creativedesign': 'custom:graphic-design.webp',
        'graphicdesign': 'custom:graphic-design.webp',
        'logo': 'custom:graphic-design.webp',
        'housekeeping': 'custom:house-cleaning.webp',
        'handyman': 'custom:general-handyman.webp',
        'maintenance': 'custom:general-handyman.webp',
        'welding': 'custom:welding.webp'
      };
      iconStr = legacyMap[normalizedSearch] || '';
    }

    const resolved = getProfessionIconByName(iconStr, categoryIconStr);
    return resolved;
  }, [categories]);
  useEffect(() => {
    settingsService.getJobCategories().then(res => {
      const fetchedCategories: JobCategory[] = res.categories || [];
      setCategories(fetchedCategories);
      setIconTimestamp(Date.now());
      const allProfessions = fetchedCategories
        .flatMap((cat: JobCategory) => cat.professions || [])
        .map((prof: any) => prof.name)
        .sort();
      setProfessionsList(allProfessions);
    }).catch(err => {
      console.error('Failed to fetch dynamic categories:', err);
    });
  }, []);

  const queryParams = useMemo(() => ({
    page: pagination.page,
    limit: pagination.limit,
    ...(searchTerm && { search: searchTerm }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(professionFilter !== 'all' && { profession: professionFilter }),
    archived: true,
    ...(archiveTypeFilter !== 'all' && { archiveType: archiveTypeFilter })
  }), [pagination.page, pagination.limit, searchTerm, statusFilter, professionFilter, archiveTypeFilter]);

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
  }, [searchTerm, statusFilter, professionFilter, archiveTypeFilter]);

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
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-gray-100 rounded-lg">
                  <Archive className="h-5 w-5 text-gray-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Archived Jobs
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                View and manage job listings that have been hidden or removed
              </p>
            </div>
            
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-bold bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg transition-colors text-xs"
            >
              <RefreshCw className="h-4 w-4" />
              <span>REFRESH DATA</span>
            </button>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="cursor-pointer" onClick={() => setArchiveTypeFilter('all')}>
              <StatsCard
                title="Total Archived"
                value={(archivedCounts.hidden + archivedCounts.removed).toLocaleString()}
                icon={Archive}
                color="blue"
                variant="tinted"
                isActive={archiveTypeFilter === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setArchiveTypeFilter('hidden')}>
              <StatsCard
                title="Hidden Jobs"
                value={archivedCounts.hidden.toLocaleString()}
                icon={Archive}
                color="orange"
                variant="tinted"
                isActive={archiveTypeFilter === 'hidden'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setArchiveTypeFilter('removed')}>
              <StatsCard
                title="Deleted Jobs"
                value={archivedCounts.removed.toLocaleString()}
                icon={XCircle}
                color="red"
                variant="tinted"
                isActive={archiveTypeFilter === 'removed'}
                smallIcon={true}
              />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by job title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={professionFilter}
              onChange={(e) => setProfessionFilter(e.target.value)}
              className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Professions</option>
              {professionsList.map(prof => (
                <option key={prof} value={prof} className="capitalize">{prof}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm">
              <span className="text-xs font-bold text-gray-400">Limit:</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-transparent text-xs font-bold text-gray-600 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
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
            <div className="bg-white p-20 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gray-50 mb-6">
                <Archive className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-900 font-black text-xl mb-2">No archived records</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">There are no archived jobs matching your current filter criteria.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative overflow-hidden">
                <table className="min-w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[35%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Job Information
                      </th>
                      <th className="w-[23%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Customer
                      </th>
                      <th className="w-[12%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[12%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Archive Info
                      </th>
                      <th className="w-[18%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Archived Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {jobs.map((job) => {
                      const iconData = resolveIconForJob(job.category, job.icon);
                      return (
                        <tr
                          key={job._id}
                          onClick={() => openJobModal(job)}
                          className="group transition-all duration-150 cursor-pointer"
                        >
                          <td className="px-6 py-2 border-b border-gray-300">
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 flex-shrink-0 flex items-center justify-center">
                                <img 
                                  src={`${iconData.imagePath}?t=${iconTimestamp}`}
                                  alt={job.category}
                                  className="h-14 w-14 object-contain group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/assets/icons/categories/professional-services.png';
                                    (e.target as HTMLImageElement).onerror = null;
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                  {job.title}
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{iconData.label || job.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
                                 <span className="text-[10px] font-bold text-gray-500">{getInitials(job.user?.name || 'U')}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{job.user?.name || 'Anonymous'}</p>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{job.user?.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                        <td className="px-6 py-4 text-center border-b border-gray-300">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getJobStatusColor(job.status)}`}>
                            {getJobStatusIcon(job.status)}
                            {job.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                          <div className="flex flex-col items-center">
                            {job.archiveType === 'hidden' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                                <Archive className="h-2.5 w-2.5" />
                                Hidden
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
                                <ShieldAlert className="h-2.5 w-2.5" />
                                Deleted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                          <div className="flex flex-col">
                            <p className="text-xs font-bold text-gray-900">
                              {job.archivedAt ? formatDistanceToNow(new Date(job.archivedAt), { addSuffix: true }) : 'N/A'}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 mt-1">
                              <Calendar className="h-3 w-3" />
                              {job.archivedAt ? new Date(job.archivedAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {jobs.map((job) => {
                  const iconData = resolveIconForJob(job.category, job.icon);
                  return (
                    <div
                      key={job._id}
                      onClick={() => openJobModal(job)}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                           {job.archiveType === 'hidden' ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-orange-100 text-orange-700">HIDDEN</span>
                           ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700">DELETED</span>
                           )}
                           <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getJobStatusColor(job.status)}`}>
                             {job.status.replace('_', ' ')}
                           </span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase tracking-widest font-mono">
                          {job.archivedAt ? formatDistanceToNow(new Date(job.archivedAt), { addSuffix: true }) : 'N/A'}
                        </span>
                      </div>

                      <div className="p-4">
                         <div className="flex items-start gap-4 mb-4">
                          <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                             <img 
                               src={`${iconData.imagePath}?t=${iconTimestamp}`}
                               alt={job.category}
                               className="h-8 w-8 object-contain"
                               onError={(e) => {
                                 (e.target as HTMLImageElement).src = '/assets/icons/categories/professional-services.png';
                                 (e.target as HTMLImageElement).onerror = null;
                               }}
                             />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-black text-gray-900 leading-tight mb-1 truncate">
                              {job.title}
                            </h3>
                            <div className="flex items-center gap-2">
                               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                 {iconData.label || job.category || 'General Service'}
                               </span>
                            </div>
                          </div>
                         </div>

                       <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100 mb-4">
                          <div className="h-8 w-8 rounded-full bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                             <span className="text-[10px] font-black text-blue-600">{getInitials(job.user?.name || 'U')}</span>
                          </div>
                          <div className="min-w-0">
                             <p className="text-xs font-black text-gray-900 truncate">{job.user?.name || 'Anonymous'}</p>
                             <p className="text-[10px] text-gray-500 truncate">{job.user?.email || 'No email'}</p>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dashed border-gray-100">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest opacity-70">Job Budget</span>
                            <span className="text-sm font-black text-gray-900">{formatCurrency(job.budget || 0)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest opacity-70">Payment</span>
                            <span className="text-xs font-bold text-gray-900 uppercase tracking-widest">{job.paymentMethod}</span>
                          </div>
                       </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100/50">
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            {job.locationDisplay || 'Remote / Not specified'}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700">
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
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.pages}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
};

export default ArchivedJobs;
