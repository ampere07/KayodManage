import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Briefcase,
  LayoutGrid,
  Table2,
  MapPin,
  Wallet,
  Calendar,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Component imports
import { JobDetailsModal } from '../components/Modals';
import JobCounters from '../components/Jobs/JobCounters';
import {
  JobIcon,
  StatusBadge,
  StatusLine,
  Person,
  providerEmpty,
  PriceText,
  ago,
} from '../components/Jobs/JobListParts';
import { SortHeader, ListFooter, selectClass } from '../components/UI/ListControls';
import {
  JOB_STATUSES,
  resolveJobIcon,
  serviceLabel,
} from '../components/Jobs/jobListHelpers';

// Type imports
import type { Job, JobsQuickFilter, JobsSort } from '../types';

// Hooks
import { useJobs, useJobsSummary, useJobCategories } from '../hooks/useJobs';
import { useSocket as useSocketContext } from '../context/SocketContext';

const STATUS_KEYS: string[] = ['all', ...JOB_STATUSES.map((s) => s.key)];
const QUICK_FILTERS: JobsQuickFilter[] = ['dispute', 'no_quotes'];

const SORTS: { value: JobsSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'price_asc', label: 'Lowest price' },
];

/**
 * Jobs Management Page
 * Every job on the platform: where the marketplace's jobs stand, the two kinds
 * that need an admin's eye (disputes, open jobs nobody has quoted on), and a
 * list whose rows say what each job is waiting on.
 */
const Jobs: React.FC = () => {
  // The status tab and quick filter live in the URL, so links can open the
  // page on them (/jobs?status=open) and the sidebar's "All Jobs" resets them.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || 'all';
  const statusFilter = STATUS_KEYS.includes(statusParam) ? statusParam : 'all';
  const flagParam = searchParams.get('flag') as JobsQuickFilter | null;
  const flag = flagParam && QUICK_FILTERS.includes(flagParam) ? flagParam : null;

  const [searchTerm, setSearchTerm] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [sort, setSort] = useState<JobsSort>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModal, setJobModal] = useState({ isOpen: false });
  const [mobileViewType, setMobileViewType] = useState<'card' | 'table'>('card');
  const { categories, professionsList } = useJobCategories();

  const setFilters = (status: string, nextFlag: JobsQuickFilter | null) => {
    const next = new URLSearchParams();
    if (status !== 'all') next.set('status', status);
    if (nextFlag) next.set('flag', nextFlag);
    setSearchParams(next, { replace: true });
  };

  // Counters toggle: the selected one clicked again shows every job. A quick
  // filter is a view of its own, so choosing a status leaves it.
  const chooseStatus = (status: string) => setFilters(status === statusFilter && !flag ? 'all' : status, null);
  const toggleFlag = (next: JobsQuickFilter) => {
    if (flag === next) setFilters(statusFilter, null);
    else setFilters(next === 'no_quotes' ? 'open' : 'all', next);
  };

  const anyFilterActive = Boolean(searchTerm) || statusFilter !== 'all' || flag !== null
    || professionFilter !== 'all' || paymentMethodFilter !== 'all' || sort !== 'newest';
  const clearFilters = () => {
    setSearchTerm('');
    setProfessionFilter('all');
    setPaymentMethodFilter('all');
    setSort('newest');
    setFilters('all', null);
  };

  const resolveIcon = useMemo(
    () => (job: Job) => {
      const icon = resolveJobIcon(categories, job.professionName || job.categoryName || job.category || '', job.icon);
      // Cache-bust ImageKit icons with the job's last update.
      return job.icon?.startsWith('ik:') && job.updatedAt ? `${icon.imagePath}?v=${new Date(job.updatedAt).getTime()}` : icon.imagePath;
    },
    [categories]
  );

  const queryParams = useMemo(() => ({
    page,
    limit,
    ...(searchTerm && { search: searchTerm }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(professionFilter !== 'all' && { profession: professionFilter }),
    ...(paymentMethodFilter !== 'all' && { paymentMethod: paymentMethodFilter }),
    ...(flag && { flag }),
    ...(sort !== 'newest' && { sort }),
  }), [page, limit, searchTerm, statusFilter, professionFilter, paymentMethodFilter, flag, sort]);

  const queryClient = useQueryClient();
  const { socket } = useSocketContext();
  const { data: jobsData, isLoading, isPlaceholderData } = useJobs(queryParams);
  const { data: summary } = useJobsSummary();

  const jobs = jobsData?.jobs || [];
  const total = jobsData?.pagination?.total || 0;
  const pages = jobsData?.pagination?.pages || 0;

  useEffect(() => {
    if (!socket) return;

    const handleJobUpdate = (data: any) => {
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
    setPage(1);
  }, [searchTerm, statusFilter, professionFilter, paymentMethodFilter, flag, sort, limit]);

  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setJobModal({ isOpen: true });
  };

  const closeJobModal = () => {
    setJobModal({ isOpen: false });
    setTimeout(() => setSelectedJob(null), 300);
  };

  const professionOptions = [...new Set(professionsList)].map((prof: any) => (
    <option key={prof} value={prof} className="capitalize">{prof}</option>
  ));
  // What an empty list means depends on what was asked for.
  const empty = flag === 'dispute' && !searchTerm
    ? { title: 'No open disputes', text: 'Every booking is going ahead without a dispute.' }
    : flag === 'no_quotes' && !searchTerm
      ? { title: 'Every open job has a quote', text: 'Providers have quoted on all of the open jobs.' }
      : { title: 'No jobs found', text: 'Try adjusting your search or filters.' };

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Jobs Management
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {summary ? `${summary.total.toLocaleString()} jobs on the platform` : 'Every service request on the platform'}, and what each one is waiting on
              </p>
            </div>
          </div>

          <JobCounters
            summary={summary}
            status={statusFilter}
            flag={flag}
            onStatus={chooseStatus}
            onFlag={toggleFlag}
            filtered={anyFilterActive}
            onClear={clearFilters}
          />
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it (search, then
            the three selects); from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="order-1 lg:order-none flex items-center gap-2 w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <input
                type="text"
                data-testid="admin-jobs-search"
                placeholder="Search jobs, categories, or IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            </div>

            {/* Page Limit - phones (the desktop one sits by the pages) */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>

            {/* The phone list switches between cards and a compact list; the
                desktop table has one layout, so the toggle isn't shown there. */}
            <div className="lg:hidden flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm shrink-0 h-8">
              <button
                type="button"
                aria-label="Card view"
                aria-pressed={mobileViewType === 'card'}
                onClick={() => setMobileViewType('card')}
                className={`p-1.5 rounded-md transition-all ${mobileViewType === 'card' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Compact list view"
                aria-pressed={mobileViewType === 'table'}
                onClick={() => setMobileViewType('table')}
                className={`p-1.5 rounded-md transition-all ${mobileViewType === 'table' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="order-2 lg:order-none grid grid-cols-3 gap-2 w-full lg:contents">
            <select value={professionFilter} onChange={(e) => setProfessionFilter(e.target.value)} className={`${selectClass} lg:w-[150px]`}>
              <option value="all">Professions</option>
              {professionOptions}
            </select>
            <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className={`${selectClass} lg:w-[130px]`}>
              <option value="all">Payment</option>
              <option value="wallet">Wallet</option>
              <option value="xendit">Xendit</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as JobsSort)} aria-label="Sort jobs" className={`${selectClass} lg:w-[170px] xl:hidden`}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`flex-1 overflow-y-auto transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading jobs...</p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="jobs-empty">
              <div className="text-gray-300 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">{empty.title}</p>
              <p className="text-sm text-gray-500 mt-1">{empty.text}</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show all jobs
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative overflow-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className="w-[37%] xl:w-[34%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Job
                      </th>
                      <th className="w-[26%] xl:w-[24%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Client &amp; provider
                      </th>
                      <th className="w-[21%] xl:w-[17%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th
                        className="w-[16%] xl:w-[12%] px-4 xl:px-6 py-3.5 text-right text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'price_desc' ? 'descending' : sort === 'price_asc' ? 'ascending' : 'none'}
                      >
                        <SortHeader
                          label="Price"
                          dir={sort === 'price_desc' ? 'desc' : sort === 'price_asc' ? 'asc' : null}
                          onClick={() => setSort(sort === 'price_desc' ? 'price_asc' : 'price_desc')}
                        />
                      </th>
                      <th
                        className="hidden xl:table-cell w-[13%] px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'newest' ? 'descending' : sort === 'oldest' ? 'ascending' : 'none'}
                      >
                        <SortHeader
                          label="Posted"
                          dir={sort === 'newest' ? 'desc' : sort === 'oldest' ? 'asc' : null}
                          onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {jobs.map((job) => (
                      <tr
                        key={job._id}
                        data-testid={`admin-job-row-${job._id}`}
                        onClick={() => openJobModal(job)}
                        className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
                      >
                        <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle overflow-hidden">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center">
                              <JobIcon src={resolveIcon(job)} className="h-12 w-12 object-contain group-hover:scale-105 transition-transform" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-gray-400 font-bold tracking-wider truncate">{serviceLabel(job)}</p>
                              <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{job.title}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500 min-w-0">
                                {job.locationDisplay && job.locationDisplay !== 'Location not specified' ? (
                                  <>
                                    <MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />
                                    <span className="truncate" title={job.locationDisplay}>{job.locationDisplay}</span>
                                  </>
                                ) : (
                                  <span className="truncate" title={job.description}>{job.description || 'No description'}</span>
                                )}
                                {/* Below xl the Posted column is hidden; its age rides here. */}
                                <span className="xl:hidden flex-shrink-0 text-gray-400">· {ago(job.createdAt)}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                          <div className="space-y-2 min-w-0">
                            <Person role="Client" name={job.user?.name} empty="Unknown client" />
                            <Person role="Provider" name={job.assignedTo?.name} empty={providerEmpty(job)} />
                          </div>
                        </td>
                        <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                          <div className="flex flex-col items-start gap-1.5 min-w-0">
                            <StatusBadge status={job.status} />
                            <StatusLine job={job} className="text-[11px] max-w-full" />
                          </div>
                        </td>
                        <td className="px-4 xl:px-6 py-2 text-right border-b border-gray-200 h-20 align-middle">
                          <div className="flex flex-col items-end">
                            <PriceText job={job} className="text-sm" />
                            <div className="flex items-center gap-1 text-[9px] font-black text-gray-400 uppercase mt-0.5">
                              <Wallet className="h-2.5 w-2.5" />
                              {job.paymentMethod}
                            </div>
                          </div>
                        </td>
                        <td className="hidden xl:table-cell px-6 py-2 border-b border-gray-200 h-20 align-middle">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {ago(job.createdAt)}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(job.createdAt), 'MMM d, yyyy')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phones and tablets */}
              <div className="lg:hidden flex-1 flex flex-col min-h-0 bg-white">
                {mobileViewType === 'card' ? (
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {jobs.map((job) => (
                      <div
                        key={job._id}
                        onClick={() => openJobModal(job)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                          <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                            <JobIcon src={resolveIcon(job)} className="h-9 w-9 object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-gray-400 tracking-wider truncate">{serviceLabel(job)}</p>
                            <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{job.title}</p>
                            <StatusLine job={job} className="mt-1 text-[11px]" />
                          </div>
                          <StatusBadge status={job.status} small />
                        </div>

                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <Person small role="Client" name={job.user?.name} empty="Unknown client" />
                            {job.assignedTo?.name && <Person small role="Provider" name={job.assignedTo.name} />}
                          </div>
                          <PriceText job={job} className="text-sm flex-shrink-0" />
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {ago(job.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto py-2 space-y-px bg-gray-100">
                    {jobs.map((job) => (
                      <div
                        key={job._id}
                        onClick={() => openJobModal(job)}
                        className="bg-white flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className="h-10 w-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                          <JobIcon src={resolveIcon(job)} className="h-7 w-7 object-contain" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-gray-400 tracking-wider truncate">{serviceLabel(job)}</p>
                          <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{job.title}</p>
                          <StatusLine job={job} className="mt-0.5 text-[10px]" />
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <StatusBadge status={job.status} small />
                          <PriceText job={job} className="text-sm" />
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400">
                            <Clock className="h-2.5 w-2.5" />
                            {ago(job.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!isLoading && jobs.length > 0 && (
          <ListFooter page={page} limit={limit} total={total} pages={pages} onPage={setPage} onLimit={setLimit} />
        )}
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

export default Jobs;
