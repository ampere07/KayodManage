import React, { useState, useEffect, useRef } from 'react';
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
import { alertsService } from '../services';
import { ReviewReportModal } from '../components/Modals';
import type { 
  ReportedPost, 
  ReportFilterStatus 
} from '../types/alerts.types';

const Alerts: React.FC = () => {
  const [reportedPosts, setReportedPosts] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    fetchReportedPosts();
  }, []);

  // Handle reportId from URL params
  useEffect(() => {
    const reportId = searchParams.get('reportId');
    const alertId = searchParams.get('alertId');
    const targetId = reportId || alertId;
    
    if (targetId && reportedPosts.length > 0) {
      const post = reportedPosts.find(p => p._id === targetId);
      if (post) {
        // Set the highlighted post
        setHighlightedPostId(targetId);
        
        // Open the modal automatically
        setSelectedPost(post);
        setIsModalOpen(true);
        
        // Scroll to the highlighted row after a short delay
        setTimeout(() => {
          highlightedRowRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 300);
        
        // Clear the URL parameter after processing
        searchParams.delete('reportId');
        searchParams.delete('alertId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [reportedPosts, searchParams, setSearchParams]);

  const fetchReportedPosts = async () => {
    setLoading(true);
    try {
      const data = await alertsService.getReportedPosts();
      setReportedPosts(data.reportedPosts || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
      console.error('Error fetching reported posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewPost = async (postId: string, action: 'approve' | 'dismiss' | 'delete') => {
    setActionLoading(true);
    try {
      const result = await alertsService.reviewReportedPost(postId, {
        action,
        adminNotes: 'Action taken by admin'
      });
      
      setReportedPosts(prev => 
        prev.map(post => 
          post._id === postId 
            ? { ...post, ...result.reportedPost, status: result.reportedPost.status }
            : post
        )
      );

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
    // Keep the highlight for a few seconds after closing modal
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

  const getFilteredPosts = () => {
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
  };

  const filteredPosts = getFilteredPosts();
  const pendingCount = reportedPosts.filter(post => post.status === 'pending').length;
  
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
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {pendingCount > 0 && (
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by job title, reporter name, reason, or comment..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'All', count: reportedPosts.length },
              { key: 'pending', label: 'Pending', count: reportedPosts.filter(p => p.status === 'pending').length },
              { key: 'reviewed', label: 'Reviewed', count: reportedPosts.filter(p => p.status === 'reviewed').length },
              { key: 'resolved', label: 'Resolved', count: reportedPosts.filter(p => p.status === 'resolved').length },
              { key: 'dismissed', label: 'Dismissed', count: reportedPosts.filter(p => p.status === 'dismissed').length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setFilter(tab.key as ReportFilterStatus);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                  filter === tab.key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex-shrink-0 mx-6 mt-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            <span>Error: {error}</span>
          </div>
        </div>
      )}

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {filteredPosts.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-white p-12">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ? 'No matching reports found' : 
                   filter === 'all' ? 'No reported posts found' : `No ${filter} reports`}
                </h2>
                <p className="text-gray-600">
                  {searchTerm ? 'Try adjusting your search terms' :
                   filter === 'pending' ? 'All reports have been reviewed!' : 'Check back later for new reports.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white overflow-hidden">
              <table className="min-w-full w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[30%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Details
                    </th>
                    <th className="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Report Info
                    </th>
                    <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedPosts.map((post, index) => {
                    const isHighlighted = highlightedPostId === post._id;
                    
                    return (
                    <React.Fragment key={post._id}>
                      <tr 
                        ref={isHighlighted ? highlightedRowRef : null}
                        className={`hover:bg-gray-50 transition-all duration-300 ${
                          isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset shadow-lg' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {post.jobId.title}
                            </div>
                            <div className="text-sm text-gray-500 line-clamp-2">
                              {post.jobId.description}
                            </div>
                            <div className="flex items-center mt-1 text-xs text-gray-400">
                              <span className="bg-gray-100 px-2 py-1 rounded">
                                {post.jobId.category}
                              </span>
                              <span className="ml-2">
                                {formatBudgetWithType(post.jobId.budget, post.jobId.budgetType)}
                              </span>
                              {post.jobId.media && post.jobId.media.length > 0 && (
                                <span className="ml-2 flex items-center text-blue-600">
                                  <ImageIcon className="h-3 w-3 mr-1" />
                                  {post.jobId.media.length} file{post.jobId.media.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {post.jobId.isDeleted && (
                                <span className="ml-2 flex items-center text-red-600 font-medium">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Deleted
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <div className="flex items-center text-sm text-gray-900 mb-1">
                              <Flag className="h-4 w-4 text-red-500 mr-1" />
                              <span className="font-medium">{formatReason(post.reason)}</span>
                            </div>
                            <div className="text-sm text-gray-600 line-clamp-2 mb-2">
                              "{post.comment}"
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <User className="h-3 w-3 mr-1" />
                              <span>{post.reportedBy.providerName}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(post.status)}`}>
                            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                          </span>
                          {post.status !== 'pending' && post.reviewedAt && (
                            <div className="text-xs text-gray-500 mt-1">
                              Reviewed {formatDate(post.reviewedAt)}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleViewPost(post)}
                            className={`inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                              post.status === 'pending'
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {post.status === 'pending' ? 'Review' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {index < paginatedPosts.length - 1 && (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <div className="border-b border-gray-200" />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review Report Modal */}
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

export default Alerts;
