import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  Eye, 
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Flag,
  Search,
  Image as ImageIcon,
  XCircle
} from 'lucide-react';
import { formatBudgetWithType } from '../utils/currency';
import { ReviewReportModal } from '../components/Modals';
import { useFlaggedPosts, useFlaggedUsersStats, useReviewReportedPost } from '../hooks';
import type { 
  ReportedPost, 
  ReportFilterStatus 
} from '../types/flagged.types';

const Flagged: React.FC = () => {
  const { data: reportedPosts = [], isLoading: loading } = useFlaggedPosts();
  const { data: flaggedUsersStats = { total: 0, customers: 0, providers: 0 } } = useFlaggedUsersStats();
  const reviewPostMutation = useReviewReportedPost();

  const [selectedPost, setSelectedPost] = useState<ReportedPost | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  useEffect(() => {
    const reportId = searchParams.get('reportId');
    const alertId = searchParams.get('alertId');
    const targetId = reportId || alertId;
    
    if (targetId && reportedPosts.length > 0) {
      const post = reportedPosts.find(p => p._id === targetId);
      if (post) {
        setHighlightedPostId(targetId);
        setSelectedPost(post);
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
  }, [reportedPosts, searchParams, setSearchParams]);

  const handleReviewPost = async (postId: string, action: 'approve' | 'dismiss' | 'delete') => {
    setActionLoading(true);
    try {
      await reviewPostMutation.mutateAsync({
        postId,
        action,
        adminNotes: 'Action taken by admin'
      });

      setIsModalOpen(false);
      setSelectedPost(null);
      
      const actionMessages = {
        approve: 'Post approved and kept',
        dismiss: 'Report dismissed',
        delete: 'Post deleted successfully'
      };
      
      alert(actionMessages[action]);
      
    } catch (err: any) {
      console.error('Error reviewing post:', err);
      alert(err?.response?.data?.message || err?.message || 'An error occurred while reviewing the post');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewPost = (post: ReportedPost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
    setTimeout(() => {
      setHighlightedPostId(null);
    }, 3000);
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
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatReason = (reason: string) => {
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredPosts = useMemo(() => {
    let filtered = reportedPosts;
    
    if (filter !== 'all') {
      filtered = filtered.filter(post => post.status === filter);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(post => 
        post.jobId.title.toLowerCase().includes(search) ||
        post.reportedBy.providerName.toLowerCase().includes(search) ||
        post.reason.toLowerCase().includes(search) ||
        post.comment.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [reportedPosts, filter, searchTerm]);

  const pendingCount = useMemo(() => 
    reportedPosts.filter(post => post.status === 'pending').length,
    [reportedPosts]
  );
  
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading reported posts...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Flagged</h1>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {pendingCount > 0 && (
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-0.5">Total Flagged Users</div>
                <div className="text-lg font-bold text-gray-900">{flaggedUsersStats.total}</div>
              </div>
              <div className="w-px h-10 bg-gray-300 mx-2"></div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-0.5">Customer</div>
                <div className="text-lg font-bold text-blue-600">{flaggedUsersStats.customers}</div>
              </div>
              <div className="w-px h-10 bg-gray-300 mx-2"></div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-0.5">Provider</div>
                <div className="text-lg font-bold text-purple-600">{flaggedUsersStats.providers}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({reportedPosts.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'pending' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('reviewed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'reviewed' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Reviewed
            </button>
            <button
              onClick={() => setFilter('dismissed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'dismissed' 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Dismissed
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'resolved' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
          
          <div className="relative flex-grow sm:flex-grow-0 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {paginatedPosts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Flag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-500">
              {filter !== 'all' 
                ? 'Try adjusting your filters or search term.' 
                : 'No posts have been reported yet.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reported By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedPosts.map((post) => (
                    <tr 
                      key={post._id}
                      ref={highlightedPostId === post._id ? highlightedRowRef : null}
                      className={`hover:bg-gray-50 transition-all ${
                        highlightedPostId === post._id ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {post.jobId.images && post.jobId.images.length > 0 ? (
                              <img
                                className="h-10 w-10 rounded object-cover"
                                src={post.jobId.images[0]}
                                alt="Job"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                              {post.jobId.title}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatBudgetWithType(post.jobId.budget, post.jobId.budgetType)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            {post.reportedBy.providerName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{formatReason(post.reason)}</div>
                        {post.comment && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                            {post.comment}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(post.reportedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(post.status)}`}>
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewPost(post)}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center mx-auto"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(startIndex + itemsPerPage, filteredPosts.length)}
                        </span>{' '}
                        of <span className="font-medium">{filteredPosts.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          const pageNumber = i + 1;
                          return (
                            <button
                              key={pageNumber}
                              onClick={() => setCurrentPage(pageNumber)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNumber
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ReviewReportModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        reportedPost={selectedPost}
        onReview={handleReviewPost}
        isLoading={actionLoading}
      />
    </div>
  );
};

export default Flagged;
