import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search,
  Archive,
  LayoutGrid,
  Table2,
  MapPin,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';

// Component imports
import { JobDetailsModal } from '../components/Modals';
import CounterGroups from '../components/UI/CounterGroups';
import type { Counter, CounterGroup, Tone } from '../components/UI/CounterGroups';
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
import { JOB_STATUSES, jobPrice, peso, resolveJobIcon, serviceLabel } from '../components/Jobs/jobListHelpers';

// Type imports
import type { Job, JobsSort, ArchivedJobsSummary } from '../types';

// Hooks
import { useArchivedJobs, useArchivedJobsSummary, useJobCategories } from '../hooks/useJobs';
import { useSocket as useSocketContext } from '../context/SocketContext';

type ArchiveType = 'all' | 'hidden' | 'removed';
const ARCHIVE_TYPES: ArchiveType[] = ['all', 'hidden', 'removed'];
const STATUS_KEYS: string[] = ['all', ...JOB_STATUSES.map((s) => s.key)];

const SORTS: { value: JobsSort; label: string }[] = [
  { value: 'archived_desc', label: 'Last archived' },
  { value: 'archived_asc', label: 'First archived' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'price_asc', label: 'Lowest price' },
];

const STATUS_COUNTERS: { key: Job['status']; label: string; tone: Tone; hint: string }[] = [
  { key: 'open', label: 'Open', tone: 'blue', hint: 'Was still waiting for a provider' },
  { key: 'scheduled', label: 'Scheduled', tone: 'violet', hint: 'Had a provider booked for a date' },
  { key: 'in_progress', label: 'In progress', tone: 'amber', hint: 'Work was under way' },
  { key: 'completed', label: 'Completed', tone: 'emerald', hint: 'Was already done' },
  { key: 'cancelled', label: 'Cancelled', tone: 'red', hint: 'Had been called off' },
  { key: 'expired', label: 'Expired', tone: 'gray', hint: 'Nobody was booked before the date passed' },
];

/** How a job was taken down, and when. Deleted wins when a job is both. */
const archiveOf = (job: Job) => job.isDeleted
  ? { kind: 'Deleted', at: job.deletedAt, text: 'text-red-600', dot: 'bg-red-500' }
  : { kind: 'Hidden', at: job.hiddenAt, text: 'text-orange-600', dot: 'bg-orange-500' };

const ArchiveLine: React.FC<{ job: Job; className?: string }> = ({ job, className = '' }) => {
  const archive = archiveOf(job);
  return (
    <span className={`flex items-center gap-1.5 min-w-0 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${archive.dot}`} />
      <span className={`font-bold ${archive.text}`}>{archive.kind}</span>
      {archive.at && <span className="text-gray-400 truncate">· {ago(archive.at)}</span>}
    </span>
  );
};

/**
 * Archived Jobs Page
 * Jobs taken off the platform, hidden or deleted. The same counters, rows and
 * footer as the Jobs page; here the counters split the archive by how a job
 * was taken down and by the status it was in, and the list runs from the most
 * recently archived.
 */
const ArchivedJobs: React.FC = () => {
  // Both counter filters live in the URL, and the sidebar's "Archived" link
  // resets them. They combine: Hidden + Completed is completed jobs that were hidden.
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = (searchParams.get('type') || 'all') as ArchiveType;
  const archiveType: ArchiveType = ARCHIVE_TYPES.includes(typeParam) ? typeParam : 'all';
  const statusParam = searchParams.get('status') || 'all';
  const statusFilter = STATUS_KEYS.includes(statusParam) ? statusParam : 'all';

  const [searchTerm, setSearchTerm] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [sort, setSort] = useState<JobsSort>('archived_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModal, setJobModal] = useState({ isOpen: false });
  const [mobileViewType, setMobileViewType] = useState<'card' | 'table'>('card');
  const { categories, professionsList } = useJobCategories();

  const setFilters = (type: ArchiveType, status: string) => {
    const next = new URLSearchParams();
    if (type !== 'all') next.set('type', type);
    if (status !== 'all') next.set('status', status);
    setSearchParams(next, { replace: true });
  };
  // Counters toggle: the selected one clicked again lifts that filter.
  const chooseType = (type: ArchiveType) => setFilters(type === archiveType ? 'all' : type, statusFilter);
  const chooseStatus = (status: string) => setFilters(archiveType, status === statusFilter ? 'all' : status);

  const anyFilterActive = Boolean(searchTerm) || archiveType !== 'all' || statusFilter !== 'all'
    || professionFilter !== 'all' || paymentMethodFilter !== 'all' || sort !== 'archived_desc';
  const clearFilters = () => {
    setSearchTerm('');
    setProfessionFilter('all');
    setPaymentMethodFilter('all');
    setSort('archived_desc');
    setFilters('all', 'all');
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
    sort,
    ...(searchTerm && { search: searchTerm }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(professionFilter !== 'all' && { profession: professionFilter }),
    ...(paymentMethodFilter !== 'all' && { paymentMethod: paymentMethodFilter }),
    ...(archiveType !== 'all' && { archiveType }),
  }), [page, limit, sort, searchTerm, statusFilter, professionFilter, paymentMethodFilter, archiveType]);

  const queryClient = useQueryClient();
  const { socket } = useSocketContext();
  const { data: jobsData, isLoading, isPlaceholderData } = useArchivedJobs(queryParams);
  const { data: summary } = useArchivedJobsSummary();

  const jobs = jobsData?.jobs || [];
  const total = jobsData?.pagination?.total || 0;
  const pages = jobsData?.pagination?.pages || 0;

  // Each counter is the rows clicking it would show, so it is narrowed by the
  // other filter: Hidden while Completed is selected counts hidden completed jobs.
  const countWhere = (type: ArchiveType, status: string, cells?: ArchivedJobsSummary['cells']) =>
    cells?.filter((c) => (type === 'all' || (type === 'hidden' ? c.hidden : c.deleted)) && (status === 'all' || c.status === status))
      .reduce((n, c) => n + c.count, 0);
  const cells = summary?.cells;
  const archivedTotal = countWhere('all', 'all', cells);

  const groups: CounterGroup[] = [
    {
      label: 'Archived',
      total: archivedTotal,
      cells: [
        {
          key: 'hidden', label: 'Hidden', tone: 'orange',
          hint: 'Taken off the listings. Open one to unhide it.',
          count: countWhere('hidden', statusFilter, cells), selected: archiveType === 'hidden', onClick: () => chooseType('hidden'),
        },
        {
          key: 'removed', label: 'Deleted', tone: 'red',
          hint: 'Removed from the platform. Open one to restore it.',
          count: countWhere('removed', statusFilter, cells), selected: archiveType === 'removed', onClick: () => chooseType('removed'),
        },
      ],
    },
    {
      label: 'Status when archived',
      cells: STATUS_COUNTERS.map((s): Counter => ({
        ...s,
        count: countWhere(archiveType, s.key, cells),
        selected: statusFilter === s.key,
        onClick: () => chooseStatus(s.key),
      })),
    },
  ];

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
  }, [searchTerm, statusFilter, professionFilter, paymentMethodFilter, archiveType, sort, limit]);

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
  const emptyTitle = archiveType === 'hidden' ? 'No hidden jobs' : archiveType === 'removed' ? 'No deleted jobs' : 'No archived jobs';

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-gray-100 rounded-lg">
                  <Archive className="h-5 w-5 text-gray-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Archived Jobs
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {archivedTotal !== undefined ? `${archivedTotal.toLocaleString()} jobs taken off the platform` : 'Jobs taken off the platform'}. Open one to unhide or restore it.
              </p>
            </div>
          </div>

          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.8fr_2fr_6fr]"
            all={{ count: archivedTotal, selected: archiveType === 'all' && statusFilter === 'all', onClick: () => setFilters('all', 'all') }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="archived-counters"
            allCell={{ label: 'All', hint: 'Every hidden or deleted job' }}
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
                placeholder="Search archived jobs..."
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
                <p className="text-gray-500">Loading archived jobs...</p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="jobs-empty">
              <div className="text-gray-300 mb-4">
                <Archive className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">{emptyTitle}</p>
              <p className="text-sm text-gray-500 mt-1">
                {anyFilterActive ? 'Try adjusting your search or filters.' : 'Jobs that are hidden or deleted will show up here.'}
              </p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show all archived jobs
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
                      <th className="w-[35%] xl:w-[32%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Job
                      </th>
                      <th className="w-[26%] xl:w-[23%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Client &amp; provider
                      </th>
                      <th className="w-[20%] xl:w-[17%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th
                        className="hidden xl:table-cell w-[12%] px-6 py-3.5 text-right text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'price_desc' ? 'descending' : sort === 'price_asc' ? 'ascending' : 'none'}
                      >
                        <SortHeader
                          label="Price"
                          dir={sort === 'price_desc' ? 'desc' : sort === 'price_asc' ? 'asc' : null}
                          onClick={() => setSort(sort === 'price_desc' ? 'price_asc' : 'price_desc')}
                        />
                      </th>
                      <th
                        className="w-[19%] xl:w-[16%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'archived_desc' ? 'descending' : sort === 'archived_asc' ? 'ascending' : 'none'}
                      >
                        <SortHeader
                          label="Archived"
                          dir={sort === 'archived_desc' ? 'desc' : sort === 'archived_asc' ? 'asc' : null}
                          onClick={() => setSort(sort === 'archived_desc' ? 'archived_asc' : 'archived_desc')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {jobs.map((job) => {
                      const archive = archiveOf(job);
                      return (
                        <tr
                          key={job._id}
                          data-testid={`admin-job-row-${job._id}`}
                          onClick={() => openJobModal(job)}
                          className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
                        >
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle overflow-hidden">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center">
                                <JobIcon src={resolveIcon(job)} className="h-12 w-12 object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition" />
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
                                  {/* Below xl the Price column is hidden; the price rides here. */}
                                  {jobPrice(job) > 0 && <span className="xl:hidden flex-shrink-0 text-gray-400">· {peso(jobPrice(job))}</span>}
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
                          <td className="hidden xl:table-cell px-6 py-2 text-right border-b border-gray-200 h-20 align-middle">
                            <div className="flex flex-col items-end">
                              <PriceText job={job} className="text-sm" />
                              <div className="flex items-center gap-1 text-[9px] font-black text-gray-400 uppercase mt-0.5">
                                <Wallet className="h-2.5 w-2.5" />
                                {job.paymentMethod}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <span className="flex items-center gap-1.5 text-xs">
                              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${archive.dot}`} />
                              <span className={`font-bold ${archive.text}`}>{archive.kind}</span>
                            </span>
                            <p className="mt-1 text-[11px] font-semibold text-gray-900 truncate">{archive.at ? ago(archive.at) : 'Date not recorded'}</p>
                            {archive.at && <p className="text-[10px] font-medium text-gray-400">{format(new Date(archive.at), 'MMM d, yyyy')}</p>}
                          </td>
                        </tr>
                      );
                    })}
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
                            <ArchiveLine job={job} className="mt-1 text-[11px]" />
                          </div>
                          <StatusBadge status={job.status} small />
                        </div>

                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <Person small role="Client" name={job.user?.name} empty="Unknown client" />
                            {job.assignedTo?.name && <Person small role="Provider" name={job.assignedTo.name} />}
                          </div>
                          <PriceText job={job} className="text-sm flex-shrink-0" />
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
                          <ArchiveLine job={job} className="mt-0.5 text-[10px]" />
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <StatusBadge status={job.status} small />
                          <PriceText job={job} className="text-sm" />
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

export default ArchivedJobs;
