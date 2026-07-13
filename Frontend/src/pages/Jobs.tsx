import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  CheckCircle,
  Clock,
  Wallet,
  Calendar,
  Users,
  Briefcase,
  FolderOpen,
  LayoutGrid,
  Table2,
  DollarSign,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { getProfessionIconByName } from '../constants/categoryIcons';

// Component imports
import { JobDetailsModal } from '../components/Modals';
import StatsCard from '../components/Dashboard/StatsCard';

// Tpye imports
import type { Job, JobsPagination } from '../types';


// Utility imports
import {
  getInitials,
  getJobStatusColor,
  getJobStatusIcon,
  formatPHPCurrency
} from '../utils';

// Hooks
import { useJobs, useJobCounts, useJobCategories } from '../hooks/useJobs';
import { useSocket as useSocketContext } from '../context/SocketContext';

/**
 * Jobs Management Page
 * Displays and manages all jobs in the system
 */
const Jobs: React.FC = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [urgentFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModal, setJobModal] = useState({ isOpen: false });
  const [pagination, setPagination] = useState<JobsPagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const { categories, professionsList } = useJobCategories();
  const [mobileViewType, setMobileViewType] = useState<'card' | 'table'>('card');

  // Resolver logic adapted from Dashboard.tsx for icons parity
  const resolveIconForJob = useMemo(() => (jobCategory: string, jobIcon?: string) => {
    if (!jobCategory) return { imagePath: '/assets/icons/categories/professional-services.png', label: 'General Service' };

    // First, try to find the profession in categories data to get the correct icon
    const normalizedSearch = jobCategory.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (const c of categories) {
      const prof = c.professions?.find((p: any) => {
        const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return pNorm === normalizedSearch || pNorm.includes(normalizedSearch) || normalizedSearch.includes(pNorm);
      });
      if (prof && prof.icon) {
        return getProfessionIconByName(prof.icon, c.icon);
      }
    }

    // If ik: prefix (ImageKit), pass directly to getProfessionIconByName
    if (jobIcon && jobIcon.startsWith('ik:')) {
      const resolved = getProfessionIconByName(jobIcon);
      return resolved;
    }

    // If a direct icon path or URL is provided, use it
    if (jobIcon && (jobIcon.startsWith('http') || jobIcon.includes('.'))) {
      // Strip custom: prefix if present
      const iconFileName = jobIcon.startsWith('custom:') ? jobIcon.replace('custom:', '') : jobIcon;
      return {
        imagePath: jobIcon.startsWith('http') ? jobIcon : `/assets/icons/professions/${iconFileName}`,
        label: jobCategory
      };
    }

    let categoryIconStr = '';
    let iconStr = '';

    // 1. Try to find in fetched categories/professions (with normalization)
    const cat = categories.find((c: any) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch);
    if (cat) {
      categoryIconStr = cat.icon || '';
    } else {
      for (const c of categories) {
        const prof = c.professions?.find((p: any) => {
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
        'welding': 'custom:welding.webp',
        'architecture': 'custom:architecture-drafting.webp',
        'architectural': 'custom:architecture-drafting.webp',
        'architecturedrafting': 'custom:architecture-drafting.webp'
      };
      iconStr = legacyMap[normalizedSearch] || '';
    }

    const resolved = getProfessionIconByName(iconStr, categoryIconStr);
    return resolved;
  }, [categories]);

  const queryParams = useMemo(() => ({
    page: pagination.page,
    limit: pagination.limit,
    ...(searchTerm && { search: searchTerm }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(professionFilter !== 'all' && { profession: professionFilter }),
    ...(paymentMethodFilter !== 'all' && { paymentMethod: paymentMethodFilter }),
    ...(urgentFilter === 'true' && { isUrgent: 'true' })
  }), [pagination.page, pagination.limit, searchTerm, statusFilter, professionFilter, paymentMethodFilter, urgentFilter]);

  const queryClient = useQueryClient();
  const { socket } = useSocketContext();
  const { data: jobsData, isLoading } = useJobs(queryParams);
  const { data: jobCounts = { total: 0, open: 0, inProgress: 0, completed: 0, totalValue: 0 } } = useJobCounts();
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
  }, [searchTerm, statusFilter, professionFilter, paymentMethodFilter, urgentFilter]);

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
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 pb-3 md:px-6 md:py-5">
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Jobs Management
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Monitor and manage all service requests across the platform
              </p>
            </div>


          </div>

          {/* Mobile Header */}
          <div className="md:hidden">
            {/* Summary strip */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Revenue</p>
                <p className="text-base font-black text-emerald-600 leading-tight">{formatCurrency(jobCounts.totalValue)}</p>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Jobs</p>
                <p className="text-base font-black text-gray-900 leading-tight">{jobCounts.total.toLocaleString()}</p>
              </div>
            </div>

            {/* Horizontal filter pills */}
            <div className="flex gap-2">
              {([
                { label: 'All',      value: jobCounts.total,     filter: 'all',         Icon: Briefcase   as React.ElementType, activeBg: 'bg-blue-500',    border: 'border-blue-500'    },
                { label: 'Open',     value: jobCounts.open,      filter: 'open',        Icon: FolderOpen  as React.ElementType, activeBg: 'bg-emerald-500', border: 'border-emerald-500' },
                { label: 'Assigned', value: jobCounts.assigned,  filter: 'in_progress', Icon: Clock       as React.ElementType, activeBg: 'bg-indigo-500',  border: 'border-indigo-500'  },
                { label: 'Done',     value: jobCounts.completed, filter: 'completed',   Icon: CheckCircle as React.ElementType, activeBg: 'bg-purple-500',  border: 'border-purple-500'  },
              ] as { label: string; value: number; filter: string; Icon: React.ElementType; activeBg: string; border: string }[]).map(({ label, value, filter, Icon, activeBg, border }) => {
                const active = statusFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full border transition-all active:scale-95 ${active ? `${activeBg} ${border} text-white` : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="text-[11px] font-black">{value.toLocaleString()}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'text-white/80' : 'text-gray-400'}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Stats Grid */}
          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="cursor-pointer transition-transform active:scale-95" onClick={() => setStatusFilter('all')}>
              <StatsCard
                title="Total"
                value={jobCounts.total.toLocaleString()}
                icon={Briefcase}
                color="blue"
                variant="tinted"
                isActive={statusFilter === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer transition-transform active:scale-95" onClick={() => setStatusFilter('open')}>
              <StatsCard
                title="Open"
                value={jobCounts.open.toLocaleString()}
                icon={FolderOpen}
                color="green"
                variant="tinted"
                isActive={statusFilter === 'open'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer transition-transform active:scale-95" onClick={() => setStatusFilter('in_progress')}>
              <StatsCard
                title="Assigned"
                value={jobCounts.assigned.toLocaleString()}
                icon={Clock}
                color="indigo"
                variant="tinted"
                isActive={statusFilter === 'in_progress'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer transition-transform active:scale-95" onClick={() => setStatusFilter('completed')}>
              <StatsCard
                title="Done"
                value={jobCounts.completed.toLocaleString()}
                icon={CheckCircle}
                color="purple"
                variant="tinted"
                isActive={statusFilter === 'completed'}
                smallIcon={true}
              />
            </div>
            <div className="md:col-span-1">
              <StatsCard
                title="Revenue"
                value={formatCurrency(jobCounts.totalValue)}
                icon={DollarSign}
                color="green"
                variant="solid"
                smallIcon={true}
                horizontalMobile={true}
              />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 py-2 md:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row md:items-center gap-2 md:gap-6">

          {/* Mobile Row 1: Search + View Toggle */}
          <div className="flex items-center gap-2 md:contents">
            <div className="relative flex-1 md:order-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
              <input
                type="text"
                placeholder="Search jobs, categories, or IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm h-8 md:h-10 md:pl-10 md:pr-4 md:rounded-xl md:text-sm"
              />
            </div>

            {/* Page Limit - Mobile only */}
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="md:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Mobile Row 2: Professions + Payment */}
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
                <span className="text-sm font-medium text-gray-700">In Progress</span>
              </div>
              <span className="text-sm font-bold text-yellow-700">{jobCounts.inProgress}</span>
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
                <span className="text-xs font-medium text-yellow-600">In Progress Jobs</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-900">{jobCounts.inProgress.toLocaleString()}</p>
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
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              data-testid="admin-jobs-search"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 md:flex gap-2 md:gap-3 flex-shrink-0">
            <select
              value={professionFilter}
              onChange={(e) => setProfessionFilter(e.target.value)}
              className="w-full bg-white px-2 py-1.5 border border-gray-200 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 truncate h-8"
            >
              <option value="all">Professions</option>
              {[...new Set(professionsList)].map((prof: any) => (
                <option key={prof} value={prof} className="capitalize">{prof}</option>
              ))}
            </select>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full bg-white px-2 py-1.5 border border-gray-200 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-8"
            >
              <option value="all">Payment</option>
              <option value="wallet">Wallet</option>
              <option value="xendit">Xendit</option>
            </select>
          </div>

          {/* Desktop: Professions + Payment + Page Limit + View Toggle */}
          <div className="hidden md:flex items-center justify-end gap-6 md:order-2">
            <div className="flex items-center gap-2">
              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[140px] truncate"
              >
                <option value="all">Professions</option>
                {[...new Set(professionsList)].map((prof: any) => (
                  <option key={prof} value={prof} className="capitalize">{prof}</option>
                ))}
              </select>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[110px]"
              >
                <option value="all">Payment</option>
                <option value="wallet">Wallet</option>
                <option value="cash">Cash</option>
                <option value="xendit">Xendit</option>
              </select>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center bg-white border border-gray-200 rounded-[12px] p-1 shadow-sm shrink-0">
              <button
                onClick={() => setMobileViewType('card')}
                className={`p-1.5 rounded-[10px] transition-all ${mobileViewType === 'card' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMobileViewType('table')}
                className={`p-1.5 rounded-[10px] transition-all ${mobileViewType === 'table' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </div>
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
              {/* Desktop View */}
              <div className="hidden md:block bg-white flex-1 relative overflow-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[35%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Job Information
                      </th>
                      <th className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Requested By
                      </th>
                      <th className="w-[18%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[12%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Price
                      </th>
                      <th className="w-[15%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Posted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {jobs.map((job) => {
                      const iconData = resolveIconForJob(job.professionName || job.categoryName || job.category || '', job.icon);
                      // Add cache-busting using profession's updatedAt timestamp
                      const iconPath = job.icon?.startsWith('ik:') && job.updatedAt
                        ? `${iconData.imagePath}?v=${new Date(job.updatedAt).getTime()}`
                        : iconData.imagePath;
                      return (
                        <tr
                          key={job._id}
                          data-testid={`admin-job-row-${job._id}`}
                          onClick={() => openJobModal(job)}
                          className="group transition-all duration-150 cursor-pointer h-20"
                        >
                          <td className="w-[35%] px-6 py-2 border-b border-gray-300 h-20 align-middle overflow-hidden max-w-full">
                            <div className="flex items-center gap-4 w-full h-full">
                              <div className="h-14 w-14 flex-shrink-0 flex items-center justify-center">
                                <img
                                  src={iconPath}
                                  alt={job.professionName || job.categoryName || job.category || 'Category'}
                                  className="h-14 w-14 object-contain group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/assets/icons/categories/professional-services.png';
                                    (e.target as HTMLImageElement).onerror = null;
                                  }}
                                />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="text-[10px] text-gray-400 font-bold tracking-wider mb-1 truncate whitespace-nowrap">
                                  {(() => {
                                    const lbl = job.professionName || job.categoryName || job.category || iconData.label || '';
                                    return /^[a-fA-F0-9]{24}$/.test(lbl) ? 'General Service' : lbl;
                                  })()}
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                    {job.title}
                                  </p>
                                  {job.isUrgent && (
                                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700">Urgent</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-600 font-medium truncate whitespace-nowrap" title={job.description}>
                                  {job.description || 'No description'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="w-[20%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
                                <span className="text-[10px] font-bold text-gray-500">{getInitials(job.user?.name || 'U')}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{job.user?.name || 'Anonymous'}</p>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{job.user?.phoneNumber || job.user?.phone || 'No phone number'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="w-[18%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getJobStatusColor(job.status)} shadow-sm`}>
                                {getJobStatusIcon(job.status)}
                                {job.status.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="w-[12%] px-6 py-2 text-center border-b border-gray-300 h-20 align-middle">
                            <div className="flex flex-col items-center">
                              <p className="text-sm font-black text-gray-900">
                                {formatCurrency(job.budget > 0 ? job.budget : (job.agreedPrice || job.acceptedProvider?.agreedPrice || 0))}
                              </p>
                              <div className="flex items-center gap-1 text-[9px] font-black text-gray-400 uppercase mt-0.5">
                                <Wallet className="h-2.5 w-2.5" />
                                {job.paymentMethod}
                              </div>
                            </div>
                          </td>
                          <td className="w-[15%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                            <div className="flex flex-col">
                              <p className="text-xs font-bold text-gray-900">
                                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 mt-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Toggleable View */}
              <div className="md:hidden flex-1 flex flex-col min-h-0 bg-white">
                {mobileViewType === 'card' ? (
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {jobs.map((job) => {
                      const iconData = resolveIconForJob(job.professionName || job.categoryName || job.category || '', job.icon);
                      const iconPath = job.icon?.startsWith('ik:') && job.updatedAt
                        ? `${iconData.imagePath}?v=${new Date(job.updatedAt).getTime()}`
                        : iconData.imagePath;
                      const price = formatCurrency(job.budget > 0 ? job.budget : (job.agreedPrice || job.acceptedProvider?.agreedPrice || 0));
                      const categoryLabel = (() => {
                        const lbl = job.professionName || job.categoryName || job.category || iconData.label || '';
                        return /^[a-fA-F0-9]{24}$/.test(lbl) ? 'General Service' : lbl;
                      })();
                      return (
                        <div
                          key={job._id}
                          onClick={() => openJobModal(job)}
                          className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                        >
                          {/* Main Row */}
                          <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
                            <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                              <img
                                src={iconPath}
                                alt=""
                                className="h-9 w-9 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/assets/icons/categories/professional-services.png';
                                  (e.target as HTMLImageElement).onerror = null;
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[130px]">
                                  {categoryLabel}
                                </span>
                                {job.isUrgent && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-100 text-red-600 flex-shrink-0">Urgent</span>
                                )}
                              </div>
                              <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{job.title}</p>
                            </div>
                            {/* Status badge */}
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border ${getJobStatusColor(job.status)} bg-white flex-shrink-0`}>
                              {getJobStatusIcon(job.status)}
                              {job.status.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Footer strip */}
                          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <div className="h-5 w-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[8px] font-black text-gray-500 flex-shrink-0">
                                {getInitials(job.user?.name || 'U')}
                              </div>
                              <p className="text-[10px] font-bold text-gray-500 truncate">{job.user?.name || 'Anonymous'}</p>
                            </div>
                            <p className="text-sm font-black text-gray-900 flex-shrink-0">{price}</p>
                            <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto py-2 space-y-px bg-gray-100">
                    {jobs.map((job) => {
                      const iconData = resolveIconForJob(job.professionName || job.categoryName || job.category || '', job.icon);
                      const iconPath = job.icon?.startsWith('ik:') && job.updatedAt
                        ? `${iconData.imagePath}?v=${new Date(job.updatedAt).getTime()}`
                        : iconData.imagePath;
                      const price = formatCurrency(job.budget > 0 ? job.budget : (job.agreedPrice || job.acceptedProvider?.agreedPrice || 0));
                      const categoryLabel = (() => {
                        const lbl = job.professionName || job.categoryName || job.category || iconData.label || '';
                        return /^[a-fA-F0-9]{24}$/.test(lbl) ? 'General Service' : lbl;
                      })();
                      return (
                        <div
                          key={job._id}
                          onClick={() => openJobModal(job)}
                          className="bg-white flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors"
                        >
                          {/* Icon */}
                          <div className="h-10 w-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                            <img
                              src={iconPath}
                              alt=""
                              className="h-7 w-7 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/icons/categories/professional-services.png';
                                (e.target as HTMLImageElement).onerror = null;
                              }}
                            />
                          </div>

                          {/* Middle: category + title + customer */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[140px]">
                                {categoryLabel}
                              </span>
                              {job.isUrgent && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-100 text-red-600 flex-shrink-0">Urgent</span>
                              )}
                            </div>
                            <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{job.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="h-4 w-4 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[7px] font-black text-gray-500 flex-shrink-0">
                                {getInitials(job.user?.name || 'U')}
                              </div>
                              <p className="text-[10px] text-gray-400 font-bold truncate">{job.user?.name || 'Anonymous'}</p>
                              <span className="text-gray-300">·</span>
                              <div className="flex items-center gap-0.5 text-[10px] font-bold text-gray-400 flex-shrink-0">
                                <Users className="h-2.5 w-2.5" />
                                {job.applicationCount || 0}
                              </div>
                            </div>
                          </div>

                          {/* Right: status + price + time */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border ${getJobStatusColor(job.status)} bg-white`}>
                              {getJobStatusIcon(job.status)}
                              {job.status.replace('_', ' ')}
                            </span>
                            <p className="text-sm font-black text-gray-900">{price}</p>
                            <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </>
          )}
        </div>

        {!loading && jobs.length > 0 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 z-10 px-4 font-inter h-[65px] flex items-center">
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
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
