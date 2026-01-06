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
import { useFlaggedPosts, useReviewReportedPost } from '../hooks';
import type { 
  ReportedPost, 
  ReportFilterStatus 
} from '../types/flagged.types';

const Flagged: React.FC = () => {
  const { data: reportedPosts = [], isLoading: loading } = useFlaggedPosts();
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

  const filteredPosts = useMemo(() => {
    let filtered = reportedPosts;
    
    // Debug: Log the first post to see the structure
    if (filtered.length > 0) {
      console.log('First post jobId:', filtered[0].jobId);
      console.log('First post jobId.media:', filtered[0].jobId.media);
    }
    
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

  const statusCounts = useMemo(() => ({
    all: reportedPosts.length,
    pending: reportedPosts.filter(post => post.status === 'pending').length,
    reviewed: reportedPosts.filter(post => post.status === 'reviewed').length,
    resolved: reportedPosts.filter(post => post.status === 'resolved').length,
    dismissed: reportedPosts.filter(post => post.status === 'dismissed').length
  }), [reportedPosts]);
  
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
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Flagged</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Review and manage reported posts from users across the platform
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`bg-gradient-to-br from-red-50 to-red-100 border-2 rounded-lg p-4 transition-all hover:shadow-md ${
              filter === 'all' ? 'border-red-500 shadow-md' : 'border-red-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide">All Reports</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{statusCounts.all}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                <Flag className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter('pending')}
            className={`bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 rounded-lg p-4 transition-all hover:shadow-md ${
              filter === 'pending' ? 'border-yellow-500 shadow-md' : 'border-yellow-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">{statusCounts.pending}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter('reviewed')}
            className={`bg-gradient-to-br from-blue-50 to-blue-100 border-2 rounded-lg p-4 transition-all hover:shadow-md ${
              filter === 'reviewed' ? 'border-blue-500 shadow-md' : 'border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Reviewed</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{statusCounts.reviewed}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter('resolved')}
            className={`bg-gradient-to-br from-green-50 to-green-100 border-2 rounded-lg p-4 transition-all hover:shadow-md ${
              filter === 'resolved' ? 'border-green-500 shadow-md' : 'border-green-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Resolved</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{statusCounts.resolved}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter('dismissed')}
            className={`bg-gradient-to-br from-gray-50 to-gray-100 border-2 rounded-lg p-4 transition-all hover:shadow-md ${
              filter === 'dismissed' ? 'border-gray-600 shadow-md' : 'border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Dismissed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{statusCounts.dismissed}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>
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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading reported posts...</p>
              </div>
            </div>
          ) : paginatedPosts.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Flag className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No reports found</p>
              <p className="text-sm text-gray-500 mt-1">
                {filter !== 'all' 
                  ? 'Try adjusting your filters or search term.' 
                  : 'No posts have been reported yet.'}
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
                        Job Post
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
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedPosts.map((post) => (
                      <tr 
                        key={post._id}
                        ref={highlightedPostId === post._id ? highlightedRowRef : null}
                        onClick={() => handleViewPost(post)}
                        className={`transition-all duration-300 hover:bg-gray-50 cursor-pointer ${
                          highlightedPostId === post._id ? 'bg-yellow-100 ring-2 ring-yellow-400' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {(() => {
                                // Try different possible image sources
                                let imageUrl = null;
                                
                                // Check media array
                                if (post.jobId.media && post.jobId.media.length > 0) {
                                  imageUrl = post.jobId.media[0].url || post.jobId.media[0];
                                }
                                
                                // Check images array (fallback)
                                if (!imageUrl && (post.jobId as any).images && (post.jobId as any).images.length > 0) {
                                  imageUrl = (post.jobId as any).images[0];
                                }
                                
                                return imageUrl ? (
                                  <img
                                    className="h-10 w-10 rounded object-cover"
                                    src={typeof imageUrl === 'string' ? imageUrl : imageUrl.url}
                                    alt="Job"
                                    onError={(e) => {
                                      console.error('Image failed to load:', imageUrl);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="h-10 w-10 rounded bg-gray-200 flex items-center justify-center"><svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                                    }}
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-gray-400" />
                                  </div>
                                );
                              })()}
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
                            {formatDate(post.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(post.status)}`}>
                            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
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
                {paginatedPosts.map((post) => (
                  <div 
                    key={post._id}
                    ref={highlightedPostId === post._id ? highlightedRowRef : null}
                    onClick={() => handleViewPost(post)}
                    className={`bg-white rounded-lg border border-gray-200 p-4 transition-all duration-300 cursor-pointer hover:shadow-md ${
                      highlightedPostId === post._id ? 'bg-yellow-100 ring-2 ring-yellow-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0 h-12 w-12">
                        {(() => {
                          // Try different possible image sources
                          let imageUrl = null;
                          
                          // Check media array
                          if (post.jobId.media && post.jobId.media.length > 0) {
                            imageUrl = post.jobId.media[0].url || post.jobId.media[0];
                          }
                          
                          // Check images array (fallback)
                          if (!imageUrl && (post.jobId as any).images && (post.jobId as any).images.length > 0) {
                            imageUrl = (post.jobId as any).images[0];
                          }
                          
                          return imageUrl ? (
                            <img
                              className="h-12 w-12 rounded object-cover"
                              src={typeof imageUrl === 'string' ? imageUrl : imageUrl.url}
                              alt="Job"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="h-12 w-12 rounded bg-gray-200 flex items-center justify-center"><svg class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                              }}
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{post.jobId.title}</h3>
                        <p className="text-xs text-gray-500">{formatBudgetWithType(post.jobId.budget, post.jobId.budgetType)}</p>
                      </div>
                    </div>

                    <div className="mb-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{post.reportedBy.providerName}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">{formatReason(post.reason)}</div>
                      {post.comment && (
                        <p className="text-xs text-gray-500 mt-1">{post.comment}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(post.status)}`}>
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
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
                          {Math.min(startIndex + itemsPerPage, filteredPosts.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{filteredPosts.length}</span> results
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
