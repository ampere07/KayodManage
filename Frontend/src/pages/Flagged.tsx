import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SidebarContext } from '../components/Layout/Layout';
import {
  AlertTriangle,
  Eye,
  Calendar,
  User,
  Search,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  XCircle,
  Flag,
  Activity as ActivityIcon,
  MessageSquare,
  Users,
  CreditCard,
  Star,
  MoreHorizontal
} from 'lucide-react';
import { formatBudgetWithType } from '../utils/currency';
import { getInitials } from '../utils';
import { ReviewReportModal } from '../components/Modals';
import { useReports, useUpdateReport } from '../hooks';
import type { ReportFilterStatus } from '../types/alerts.types';
import type { Report } from '../services/flaggedService';
import type { ReportedPost } from '../types/flagged.types';

const Flagged: React.FC = () => {
  const { data: reportsData, isLoading } = useReports();
  const updateReportMutation = useUpdateReport();
  
  const reports = reportsData?.reports || [];
  const stats = reportsData?.stats || { total: 0, pending: 0, reviewed: 0, resolved: 0, dismissed: 0 };
  
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

      const actionMessages = {
        reviewed: 'Report marked as reviewed',
        resolved: 'Report resolved',
        dismissed: 'Report dismissed'
      };

      alert(actionMessages[status as keyof typeof actionMessages] || 'Report updated');

    } catch (err: any) {
      console.error('Error updating report:', err);
      alert(err?.response?.data?.message || err?.message || 'An error occurred while updating the report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (postId: string, action: 'approve' | 'dismiss' | 'delete') => {
    if (!selectedReport) return;

    const statusMap = {
      approve: 'resolved',
      dismiss: 'dismissed',
      delete: 'resolved'
    };

    await handleUpdateReport(selectedReport._id, statusMap[action], action);
  };

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
    setTimeout(() => {
      setHighlightedPostId(null);
    }, 3000);
  };

  const getReportTypeIcon = (reportType: string) => {
    const icons = {
      job: <ImageIcon className="h-4 w-4" />,
      user: <Users className="h-4 w-4" />,
      message: <MessageSquare className="h-4 w-4" />,
      conversation: <MessageSquare className="h-4 w-4" />,
      review: <Star className="h-4 w-4" />,
      payment: <CreditCard className="h-4 w-4" />,
      other: <MoreHorizontal className="h-4 w-4" />
    };
    return icons[reportType as keyof typeof icons] || icons.other;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      reviewed: 'bg-blue-100 text-blue-800 border border-blue-200',
      resolved: 'bg-green-100 text-green-800 border border-green-200',
      dismissed: 'bg-gray-100 text-gray-800 border border-gray-200'
    };

    return badges[status as keyof typeof badges] || badges.pending;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatReason = (reason: string) => {
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Convert Report to ReportedPost format for the existing modal
  const convertReportToReportedPost = (report: Report): ReportedPost => {
    return {
      _id: report._id,
      jobId: { 
        _id: report.relatedId,
        title: `${report.reportType} Report`,
        description: report.comment || 'No description',
        category: report.reportType,
        budget: 0,
        budgetType: 'fixed',
        paymentMethod: 'Not specified',
        location: {
          address: 'Not specified',
          city: 'Not specified'
        },
        createdAt: report.createdAt,
        isDeleted: false,
        media: []
      },
      jobDetails: {
        title: `${report.reportType} Report`,
        description: report.comment,
        budget: 0,
        budgetType: 'fixed'
      },
      jobPosterId: report.reportedUserId || {
        _id: '',
        name: 'Unknown',
        email: ''
      },
      reportedBy: report.reportedBy._id,
      reportedByDetails: {
        _id: report.reportedBy._id,
        providerName: report.reportedBy.name,
        email: report.reportedBy.email
      },
      reason: report.reason,
      comment: report.comment,
      status: report.status as 'pending' | 'resolved' | 'dismissed',
      adminNotes: report.adminNotes,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };
  };

  const filteredReports = useMemo(() => {
    let filtered = reports;

    if (filter !== 'all') {
      filtered = filtered.filter(report => report.status === filter);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(report =>
        report.reportType.toLowerCase().includes(search) ||
        report.reportedBy.name.toLowerCase().includes(search) ||
        report.reason.toLowerCase().includes(search) ||
        report.comment.toLowerCase().includes(search) ||
        (report.reportedUserId?.name || '').toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [reports, filter, searchTerm]);

  const statusCounts = useMemo(() => ({
    all: stats.total,
    pending: stats.pending,
    reviewed: stats.reviewed,
    resolved: stats.resolved,
    dismissed: stats.dismissed
  }), [stats]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading reported posts...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Flagged</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Review and manage reported posts from users across the platform
          </p>
        </div>

        {/* Mobile: Compact Grid */}
        <div className="grid grid-cols-2 gap-2 md:hidden mb-4">
          <div
            onClick={() => setFilter('all')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-red-50 border-red-200 ${filter === 'all' ? 'border-red-400 ring-2 ring-red-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-gray-700">Total</span>
            </div>
            <span className="text-sm font-bold text-red-700">{statusCounts.all}</span>
          </div>

          <div
            onClick={() => setFilter('pending')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-yellow-50 border-yellow-200 ${filter === 'pending' ? 'border-yellow-400 ring-2 ring-yellow-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-700">Pending</span>
            </div>
            <span className="text-sm font-bold text-yellow-700">{statusCounts.pending}</span>
          </div>

          <div
            onClick={() => setFilter('resolved')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-green-50 border-green-200 ${filter === 'resolved' ? 'border-green-400 ring-2 ring-green-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Resolved</span>
            </div>
            <span className="text-sm font-bold text-green-700">{statusCounts.resolved}</span>
          </div>

          <div
            onClick={() => setFilter('dismissed')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-gray-100 border-gray-200 ${filter === 'dismissed' ? 'border-gray-400 ring-2 ring-gray-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Dismissed</span>
            </div>
            <span className="text-sm font-bold text-gray-700">{statusCounts.dismissed}</span>
          </div>
        </div>

        {/* Desktop: Full Grid */}
        <div className="hidden md:grid grid-cols-4 gap-3 mb-4">
          <div
            onClick={() => setFilter('all')}
            className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filter === 'all' ? 'border-red-500 ring-2 ring-red-400 shadow-lg' : 'border-red-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">All Reports</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{statusCounts.all}</p>
          </div>

          <div
            onClick={() => setFilter('pending')}
            className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filter === 'pending' ? 'border-yellow-500 ring-2 ring-yellow-400 shadow-lg' : 'border-yellow-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Pending</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{statusCounts.pending}</p>
          </div>

          <div
            onClick={() => setFilter('resolved')}
            className={`bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filter === 'resolved' ? 'border-green-500 ring-2 ring-green-400 shadow-lg' : 'border-green-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Resolved</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{statusCounts.resolved}</p>
          </div>

          <div
            onClick={() => setFilter('dismissed')}
            className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${filter === 'dismissed' ? 'border-gray-600 ring-2 ring-gray-500 shadow-lg' : 'border-gray-300'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Dismissed</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{statusCounts.dismissed}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading reported posts...</p>
              </div>
            </div>
          ) : paginatedReports.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Flag className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No reports found</p>
              <p className="text-sm text-gray-500 mt-1">
                {filter !== 'all'
                  ? 'Try adjusting your filters or search term.'
                  : 'No reports have been submitted yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reported User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reported By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedReports.map((report) => (
                      <tr
                        key={report._id}
                        ref={highlightedPostId === report._id ? highlightedRowRef : null}
                        onClick={() => handleViewReport(report)}
                        className={`transition-all duration-300 hover:bg-gray-50 cursor-pointer ${highlightedPostId === report._id ? 'bg-yellow-100 ring-2 ring-yellow-400' : ''
                          }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                              {getReportTypeIcon(report.reportType)}
                            </div>
                            <div className="text-sm font-medium text-gray-900 capitalize">
                              {report.reportType}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {report.reportedUserId?.name || 'N/A'}
                          </div>
                          {report.reportedUserId?.email && (
                            <div className="text-xs text-gray-500">
                              {report.reportedUserId.email}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm text-gray-900">
                              {report.reportedBy.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{formatReason(report.reason)}</div>
                          {report.comment && (
                            <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                              {report.comment}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(report.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(report.status)}`}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-blue-600 font-medium inline-flex items-center">
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {paginatedReports.map((report) => (
                  <div
                    key={report._id}
                    ref={highlightedPostId === report._id ? highlightedRowRef : null}
                    onClick={() => handleViewReport(report)}
                    className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 cursor-pointer active:scale-[0.98] ${highlightedPostId === report._id ? 'ring-2 ring-yellow-400 bg-yellow-50' : 'hover:shadow-md'
                      }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                          {getReportTypeIcon(report.reportType)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight capitalize">
                            {report.reportType} Report
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            ID: {report._id.slice(-6).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {/* Reported User */}
                      {report.reportedUserId && (
                        <div className="flex items-start gap-2 mb-4">
                          <Users className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-bold text-gray-900 leading-tight">
                              {report.reportedUserId.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {report.reportedUserId.email}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Reporter */}
                      <div className="flex items-start gap-2 mb-4">
                        <User className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-gray-900 leading-tight">
                            Reported by: {report.reportedBy.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {report.reportedBy.email}
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="flex items-start gap-2 mb-4">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-gray-900 leading-tight">
                            {formatReason(report.reason)}
                          </div>
                          {report.comment && (
                            <div className="text-xs text-gray-500 mt-1 max-w-xs">
                              {report.comment}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusBadge(report.status)}`}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(report.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(report.createdAt)}</span>
                      </div>
                      <span className="text-blue-600 font-medium inline-flex items-center text-xs">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Review
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700 text-center md:text-left">
                        Showing{' '}
                        <span className="font-medium">{startIndex + 1}</span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(startIndex + itemsPerPage, filteredReports.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{filteredReports.length}</span> results
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
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

      <ReviewReportModal
        isOpen={isModalOpen && !!selectedReport}
        onClose={handleCloseModal}
        reportedPost={selectedReport ? convertReportToReportedPost(selectedReport) : null}
        onReview={handleReview}
        isLoading={actionLoading}
      />
    </div>
  );
};

export default Flagged;
