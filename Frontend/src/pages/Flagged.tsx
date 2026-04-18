import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SidebarContext } from '../components/Layout/Layout';
import {
  AlertTriangle,
  Eye,
  Calendar,
  Search,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  XCircle,
  Flag,
  MessageSquare,
  Users,
  CreditCard,
  Star,
  ChevronRight,
} from 'lucide-react';
import { ReviewReportModal, TransactionDetailsModal } from '../components/Modals';
import { useReports, useUpdateReport, useUserMutations } from '../hooks';
import { transactionsService, usersService } from '../services';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import StatsCard from '../components/Dashboard/StatsCard';

// Type imports
import type { ReportFilterStatus } from '../types/alerts.types';
import type { Report } from '../services/flaggedService';
import type { Transaction } from '../types';

const Flagged: React.FC = () => {
  const { data: reportsData, isLoading, refetch } = useReports();
  const updateReportMutation = useUpdateReport();
  const mutations = useUserMutations();
  
  const allReports = reportsData?.reports || [];
  
  const reports = useMemo(() => {
    return allReports.filter((report: Report) => {
      const type = (report.reportType || '').toLowerCase();
      const reason = (report.reason || '').toLowerCase();
      const comment = (report.comment || '').toLowerCase();
      
      const isRefundRelated = 
        type.includes('refund') || 
        type.includes('payment') ||
        reason.includes('refund') || 
        reason.includes('payment') ||
        comment.includes('refund') ||
        comment.includes('payment');
        
      return !isRefundRelated;
    });
  }, [allReports]);

  const stats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((r: Report) => r.status === 'pending').length,
      reviewed: reports.filter((r: Report) => r.status === 'reviewed').length,
      resolved: reports.filter((r: Report) => r.status === 'resolved').length,
      dismissed: reports.filter((r: Report) => r.status === 'dismissed').length,
    };
  }, [reports]);
  
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isFetchingTransaction, setIsFetchingTransaction] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  const { setIsHeaderHidden } = useContext(SidebarContext);

  useEffect(() => {
    if (setIsHeaderHidden) {
      setIsHeaderHidden(isModalOpen);
    }
  }, [isModalOpen, setIsHeaderHidden]);

  useEffect(() => {
    const reportId = searchParams.get('reportId');
    const alertId = searchParams.get('alertId');
    const targetId = reportId || alertId;

    if (targetId && reports.length > 0) {
      const report = reports.find((p: Report) => p._id === targetId);
      if (report) {
        setHighlightedPostId(targetId);
        setSelectedReport(report);
        setIsModalOpen(true);

        setTimeout(() => {
          highlightedRowRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300);

        searchParams.delete('reportId');
        searchParams.delete('alertId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [reports, searchParams, setSearchParams]);

  const handleUpdateReport = async (reportId: string, status: string, action: string = 'none') => {
    setActionLoading(true);
    try {
      await updateReportMutation.mutateAsync({
        reportId,
        status,
        adminNotes: 'Action taken by admin',
        actionTaken: action
      });
      setIsModalOpen(false);
      setSelectedReport(null);
      toast.success(status === 'resolved' ? 'Report resolved' : 'Report updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (_postId: string, action: 'approve' | 'dismiss' | 'delete' | 'ban') => {
    if (!selectedReport) return;

    if (action === 'ban') {
      const reportedUserId = typeof selectedReport.reportedUserId === 'string' ? selectedReport.reportedUserId : selectedReport.reportedUserId?._id;
      if (!reportedUserId) {
        toast.error('No reported user found');
        return;
      }
      setActionLoading(true);
      try {
        await usersService.banUser(reportedUserId, `Banned due to report: ${selectedReport.reason}`);
        await handleUpdateReport(selectedReport._id, 'resolved', 'user_suspended');
      } catch (err: any) {
        toast.error('Failed to ban user');
      } finally {
        setActionLoading(false);
      }
      return;
    }
    const statusMap = { approve: 'resolved', dismiss: 'dismissed', delete: 'resolved' };
    const actionMap = { approve: 'post_approved', dismiss: 'report_dismissed', delete: 'post_deleted' };
    await handleUpdateReport(selectedReport._id, statusMap[action as keyof typeof statusMap], actionMap[action as keyof typeof actionMap]);
  };

  const handleViewReport = async (report: Report) => {
    const reportType = (report.reportType || '').toLowerCase();
    const reason = (report.reason || '').toLowerCase();
    const isPotentialRefund = reportType === 'payment' || reportType === 'refund_request' || reason.includes('refund');

    if (isPotentialRefund && report.relatedId) {
      setIsFetchingTransaction(true);
      try {
        let transaction = null;
        try { transaction = await transactionsService.getTransactionById(report.relatedId); } catch (e) {}
        if (!transaction) {
          const res = await transactionsService.getTransactions({ jobId: report.relatedId, limit: 10 });
          transaction = res.transactions.find(t => t.type === 'refund_request' || t.type === 'refund');
        }
        if (transaction) {
          setSelectedTransaction(transaction as any);
          setIsTransactionModalOpen(true);
          return;
        }
      } catch (err) {} finally { setIsFetchingTransaction(false); }
    }
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const statusCounts = useMemo(() => ({
    all: stats.total,
    pending: stats.pending,
    reviewed: stats.reviewed,
    resolved: stats.resolved,
    dismissed: stats.dismissed
  }), [stats]);

  const filteredReports = useMemo(() => {
    let filtered = reports;
    if (filter !== 'all') filtered = filtered.filter((r: Report) => r.status === filter);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter((r: Report) =>
        r.reportType.toLowerCase().includes(s) ||
        r.reportedBy.name.toLowerCase().includes(s) ||
        r.reason.toLowerCase().includes(s) ||
        (r.reportedUserId?.name || '').toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [reports, filter, searchTerm]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
      reviewed: 'bg-blue-50 text-blue-700 border-blue-100',
      resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      dismissed: 'bg-gray-50 text-gray-700 border-gray-100'
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getReportTypeIcon = (reportType: string) => {
    const icons = {
      job: <ImageIcon className="h-4 w-4" />,
      user: <Users className="h-4 w-4" />,
      message: <MessageSquare className="h-4 w-4" />,
      conversation: <MessageSquare className="h-4 w-4" />,
      review: <Star className="h-4 w-4" />,
      payment: <CreditCard className="h-4 w-4" />,
    };
    return icons[reportType as keyof typeof icons] || <Flag className="h-4 w-4" />;
  };

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Flagged Content
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">Review and resolve user complaints and reported content</p>
            </div>
            

          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => setFilter('all')}>
              <StatsCard
                title="Total Reports"
                value={statusCounts.all.toLocaleString()}
                icon={Flag}
                color="blue"
                variant="tinted"
                isActive={filter === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setFilter('pending')}>
              <StatsCard
                title="Pending"
                value={statusCounts.pending.toLocaleString()}
                icon={Clock}
                color="orange"
                variant="tinted"
                isActive={filter === 'pending'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setFilter('resolved')}>
              <StatsCard
                title="Resolved"
                value={statusCounts.resolved.toLocaleString()}
                icon={CheckCircle}
                color="green"
                variant="tinted"
                isActive={filter === 'resolved'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setFilter('dismissed')}>
              <StatsCard
                title="Dismissed"
                value={statusCounts.dismissed.toLocaleString()}
                icon={XCircle}
                color="indigo"
                variant="tinted"
                isActive={filter === 'dismissed'}
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
              placeholder="Search by keywords, reporter, or reported user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm"
            />
            {/* Mobile-only Limit */}
            <div className="flex md:hidden items-center gap-1.5 mt-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select 
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 md:order-3 shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : paginatedReports.length === 0 ? (
            <div className="bg-white p-20 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gray-50 mb-6">
                <Flag className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-900 font-black text-xl mb-2">Clean slate!</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">No reports match your current filters. Everything looks good.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative">
                <table className="min-w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[12%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Type</th>
                      <th className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported User</th>
                      <th className="w-[18%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reported By</th>
                      <th className="w-[25%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Reason & Comment</th>
                      <th className="w-[15%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Status</th>
                      <th className="w-[10%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {paginatedReports.map((report) => (
                      <tr
                        key={report._id}
                        ref={highlightedPostId === report._id ? highlightedRowRef : null}
                        onClick={() => handleViewReport(report)}
                        className={`group transition-all duration-150 cursor-pointer ${highlightedPostId === report._id ? 'bg-amber-50 ring-inset ring-2 ring-amber-400' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                              {React.cloneElement(getReportTypeIcon(report.reportType) as React.ReactElement, { className: "h-4 w-4 text-gray-400 group-hover:text-blue-500" })}
                            </div>
                            <span className="text-xs font-bold text-gray-900 group-hover:text-blue-700 transition-colors capitalize">{report.reportType}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                           <div className="flex flex-col">
                              <p className="text-xs font-bold text-gray-900">{report.reportedUserId?.name || 'N/A'}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{report.reportedUserId?.email || ''}</p>
                           </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                           <div className="flex flex-col">
                              <p className="text-xs font-bold text-gray-900">{report.reportedBy.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{report.reportedBy.email}</p>
                           </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                           <div className="flex flex-col max-w-xs">
                              <p className="text-xs font-black text-red-600 uppercase tracking-tight mb-0.5">{report.reason.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-gray-500 font-medium truncate">{report.comment || 'No additional details'}</p>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center border-b border-gray-300">
                           <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadge(report.status)}`}>
                             {report.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center border-b border-gray-300">
                          <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1 font-black text-[10px] uppercase tracking-widest">
                               <Eye className="h-4 w-4" /> REVIEW
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {paginatedReports.map((report) => (
                  <div
                    key={report._id}
                    onClick={() => handleViewReport(report)}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-gray-200 text-gray-700">{report.reportType}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusBadge(report.status)}`}>{report.status}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 capitalize">
                        {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="p-4">
                       <h3 className="text-xs font-black text-red-600 uppercase tracking-widest mb-3">{report.reason.replace(/_/g, ' ')}</h3>
                       
                       <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                             <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Reported User</p>
                             <p className="text-xs font-black text-gray-900 truncate">{report.reportedUserId?.name || 'N/A'}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                             <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Reported By</p>
                             <p className="text-xs font-black text-gray-900 truncate">{report.reportedBy.name}</p>
                          </div>
                       </div>

                       <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/50">
                          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-1">Admin Comment</p>
                          <p className="text-xs text-gray-700 leading-relaxed italic">"{report.comment || 'No additional details provided by reporter.'}"</p>
                       </div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                         <Calendar className="h-3 w-3" />
                         {new Date(report.createdAt).toLocaleDateString()}
                       </div>
                       <div className="text-blue-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1">
                          REVIEW REPORT <ChevronRight className="h-3 w-3" />
                       </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs text-gray-700">
                        Page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                       >
                         PREV
                       </button>
                       <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                       >
                         NEXT
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ReviewReportModal
        isOpen={isModalOpen && !!selectedReport}
        onClose={() => { setIsModalOpen(false); setSelectedReport(null); }}
        reportedPost={selectedReport ? {
          _id: selectedReport._id,
          jobId: { 
            _id: selectedReport.relatedId,
            title: `${selectedReport.reportType ? (selectedReport.reportType.charAt(0).toUpperCase() + selectedReport.reportType.slice(1)) : 'Post'} Report`,
            description: selectedReport.comment || 'No description',
            category: selectedReport.reportType,
            budget: 0,
            budgetType: 'fixed',
            paymentMethod: 'Not specified',
            location: { address: 'N/A', city: 'N/A', region: 'N/A', country: 'N/A' },
            createdAt: selectedReport.createdAt,
            isDeleted: false,
            media: []
          },
          reportedBy: {
            _id: selectedReport.reportedBy._id,
            providerId: selectedReport.reportedBy._id,
            providerName: selectedReport.reportedBy.name,
            providerEmail: selectedReport.reportedBy.email
          },
          jobPosterId: typeof selectedReport.reportedUserId === 'string' ? selectedReport.reportedUserId : (selectedReport.reportedUserId?._id || ''),
          reason: selectedReport.reason,
          comment: selectedReport.comment,
          status: selectedReport.status as any,
          adminNotes: selectedReport.adminNotes,
          createdAt: selectedReport.createdAt,
          updatedAt: selectedReport.updatedAt
        } : null}
        onReview={handleReview}
        isLoading={actionLoading}
        reportType={selectedReport?.reportType}
        reportedUserInfo={selectedReport?.reportedUserId && typeof selectedReport.reportedUserId === 'object' ? {
          _id: selectedReport.reportedUserId._id,
          name: selectedReport.reportedUserId.name,
          email: selectedReport.reportedUserId.email,
          userType: selectedReport.reportedUserId.userType
        } : null}
        onUserAction={async (userId, actionType, duration, reason) => {
          try {
            switch (actionType) {
              case 'restrict': await mutations.restrictUser.mutateAsync({ userId, duration: duration || 0, reason: reason || 'Restricted by admin' }); break;
              case 'suspend': await mutations.suspendUser.mutateAsync({ userId, reason: reason || 'Suspended by admin', duration: duration || 7 }); break;
              case 'ban': await mutations.banUser.mutateAsync({ userId, reason: reason || 'Banned by admin', duration: duration || 0 }); break;
              case 'delete': await mutations.softDeleteUser.mutateAsync({ userId, reason: reason || 'Deleted by admin' }); break;
            }
            toast.success(`User ${actionType}ed successfully`);
            setIsModalOpen(false);
            setSelectedReport(null);
          } catch (err: any) {
            toast.error(err?.response?.data?.message || `Failed to ${actionType} user`);
          }
        }}
      />

      <TransactionDetailsModal
        isOpen={isTransactionModalOpen}
        onClose={() => { setIsTransactionModalOpen(false); setSelectedTransaction(null); }}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Flagged;
