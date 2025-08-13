import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Eye, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Flag,
  Search,
  ArrowLeft,
  Image as ImageIcon,
  Video
} from 'lucide-react';
import { formatPHPCurrency, formatBudgetWithType } from '../utils/currency';

interface ReportedPost {
  _id: string;
  jobId: {
    _id: string;
    title: string;
    description: string;
    category: string;
    location: {
      address: string;
      city: string;
      region: string;
      country: string;
    };
    budget: number;
    budgetType: string;
    paymentMethod: string;
    media?: any[];
    isDeleted?: boolean;
    createdAt: string;
  };
  reportedBy: {
    _id: string;
    providerId: string;
    providerName: string;
    providerEmail: string;
  };
  jobPosterId: string;
  reason: string;
  comment: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

const Alerts: React.FC = () => {
  const [reportedPosts, setReportedPosts] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<ReportedPost | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'review'>('table');

  useEffect(() => {
    fetchReportedPosts();
  }, []);

  const fetchReportedPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/reported-posts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reported posts');
      }

      const data = await response.json();
      setReportedPosts(data.reportedPosts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching reported posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewPost = async (postId: string, action: 'approve' | 'dismiss' | 'delete') => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/reported-posts/${postId}/review`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          adminNotes: adminNotes.trim() || 'Action taken by admin'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to review post');
      }

      const result = await response.json();
      
      // Update the reported post in the list with new status
      setReportedPosts(prev => 
        prev.map(post => 
          post._id === postId 
            ? { ...post, ...result.reportedPost, status: result.reportedPost.status }
            : post
        )
      );

      // Go back to table view
      setViewMode('table');
      setSelectedPost(null);
      setAdminNotes('');
      
      const actionMessages = {
        approve: 'Post approved and kept',
        dismiss: 'Report dismissed',
        delete: 'Post deleted successfully'
      };
      
      alert(actionMessages[action]);
      
    } catch (err) {
      console.error('Error reviewing post:', err);
      alert(err instanceof Error ? err.message : 'An error occurred while reviewing the post');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewPost = (post: ReportedPost) => {
    setSelectedPost(post);
    setAdminNotes(post.adminNotes || '');
    setViewMode('review');
  };

  const handleBackToTable = () => {
    setViewMode('table');
    setSelectedPost(null);
    setAdminNotes('');
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

  // Filter and search logic
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
  
  // Pagination logic
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
    <div className="space-y-6">
      {viewMode === 'table' ? (
        // Table View
        <>
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-gray-600">Review and manage reported content</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {pendingCount > 0 && (
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                    {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={fetchReportedPosts}
                  disabled={loading}
                  className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by job title, reporter name, reason, or comment..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter Tabs */}
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
                      setFilter(tab.key as any);
                      setCurrentPage(1); // Reset to first page when filtering
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
            <div className="bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 mr-2" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          {/* Table */}
          {filteredPosts.length === 0 ? (
            <div className="bg-white border-b border-gray-200 p-12">
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
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Report Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedPosts.map((post) => (
                      <tr key={post._id} className="hover:bg-gray-50 transition-colors">
                        {/* Job Details */}
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
                                  <span className="mr-1">📎</span>
                                  {post.jobId.media.length} file{post.jobId.media.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {post.jobId.isDeleted && (
                                <span className="ml-2 text-red-600 font-medium">⚠️ Deleted</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Report Info */}
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

                        {/* Status */}
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

                        {/* Date */}
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          {post.status === 'pending' ? (
                            <button
                              onClick={() => handleViewPost(post)}
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewPost(post)}
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
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
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        
                        {/* Page Numbers */}
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
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
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
        </>
      ) : (
        // Review Panel View
        <div className="bg-white border border-gray-200">
          {/* Panel Header with Back Button */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={handleBackToTable}
                  className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mr-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Reports
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Review Reported Post</h2>
                  <p className="text-gray-600 text-sm">Review details and take appropriate action</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedPost?.status || 'pending')}`}>
                  {selectedPost?.status.charAt(0).toUpperCase() + selectedPost?.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {selectedPost && (
            <div className="p-6 space-y-6">
              {/* Job Details */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-lg mb-4 text-gray-900">Job Details</h3>
                <div className="space-y-3">
                  <p><strong>Title:</strong> {selectedPost.jobId.title}</p>
                  <p><strong>Description:</strong> {selectedPost.jobId.description}</p>
                  <p><strong>Category:</strong> {selectedPost.jobId.category}</p>
                  <p><strong>Budget:</strong> {formatBudgetWithType(selectedPost.jobId.budget, selectedPost.jobId.budgetType)}</p>
                  <p><strong>Payment Method:</strong> {selectedPost.jobId.paymentMethod}</p>
                  <p><strong>Location:</strong> {selectedPost.jobId.location.address}, {selectedPost.jobId.location.city}</p>
                  <p><strong>Posted:</strong> {formatDate(selectedPost.jobId.createdAt)}</p>
                  {selectedPost.jobId.isDeleted && (
                    <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-400">
                      <p className="text-red-800 font-medium">⚠️ This job has been deleted</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Job Media Section - Always show, with placeholder when no media */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-lg mb-3 text-gray-900">
                  Job Media
                  {selectedPost.jobId.media && selectedPost.jobId.media.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      ({selectedPost.jobId.media.length} file{selectedPost.jobId.media.length !== 1 ? 's' : ''})
                    </span>
                  )}
                  {selectedPost.jobId.isDeleted && selectedPost.jobId.media && selectedPost.jobId.media.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-amber-600">(Preserved from snapshot)</span>
                  )}
                </h3>
                
                {selectedPost.jobId.media && selectedPost.jobId.media.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedPost.jobId.media.map((mediaItem, index) => {
                        const mediaUrl = typeof mediaItem === 'string' ? mediaItem : mediaItem.type;
                        const mediaType = typeof mediaItem === 'string' 
                          ? (mediaUrl.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                          : mediaItem.mediaType || 'image';
                        const fileName = typeof mediaItem === 'string'
                          ? mediaUrl.split('/').pop() || 'Unknown file'
                          : mediaItem.originalName || 'Unknown file';
                        
                        return (
                          <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                mediaType === 'video' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {mediaType === 'video' ? (
                                  <><Video className="h-3 w-3 inline mr-1" />Video</>
                                ) : (
                                  <><ImageIcon className="h-3 w-3 inline mr-1" />Image</>
                                )}
                              </span>
                              {mediaItem.fileSize && (
                                <span className="text-xs text-gray-500">
                                  {(mediaItem.fileSize / 1024 / 1024).toFixed(2)} MB
                                </span>
                              )}
                            </div>
                            
                            <div className="mb-2">
                              {mediaType === 'image' ? (
                                <img
                                  src={mediaUrl}
                                  alt={fileName}
                                  className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(mediaUrl, '_blank')}
                                  onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                                    e.currentTarget.className = 'w-full h-32 object-cover rounded border opacity-50';
                                  }}
                                />
                              ) : (
                                <div className="relative">
                                  <video
                                    src={mediaUrl}
                                    className="w-full h-32 object-cover rounded border"
                                    controls
                                    preload="metadata"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const errorDiv = document.createElement('div');
                                      errorDiv.className = 'w-full h-32 bg-gray-200 rounded border flex items-center justify-center text-gray-500';
                                      errorDiv.innerHTML = '<div class="flex items-center"><span class="mr-2">🎥</span>Video not available</div>';
                                      e.currentTarget.parentNode.appendChild(errorDiv);
                                    }}
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              )}
                            </div>
                            
                            <div className="text-xs text-gray-600">
                              <p className="truncate" title={fileName}><strong>File:</strong> {fileName}</p>
                              {mediaItem.uploadedAt && (
                                <p className="mt-1"><strong>Uploaded:</strong> {formatDate(mediaItem.uploadedAt)}</p>
                              )}
                            </div>
                            
                            <div className="mt-2">
                              <a
                                href={mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Full Size
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Media Summary */}
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center text-sm text-blue-800">
                        <span className="font-medium">Media Summary:</span>
                        <span className="ml-2">
                          {selectedPost.jobId.media.filter(m => {
                            const mediaType = typeof m === 'string' 
                              ? (m.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                              : m.mediaType || 'image';
                            return mediaType === 'image';
                          }).length} image{selectedPost.jobId.media.filter(m => {
                            const mediaType = typeof m === 'string' 
                              ? (m.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                              : m.mediaType || 'image';
                            return mediaType === 'image';
                          }).length !== 1 ? 's' : ''}
                        </span>
                        <span className="mx-1">•</span>
                        <span>
                          {selectedPost.jobId.media.filter(m => {
                            const mediaType = typeof m === 'string' 
                              ? (m.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                              : m.mediaType || 'image';
                            return mediaType === 'video';
                          }).length} video{selectedPost.jobId.media.filter(m => {
                            const mediaType = typeof m === 'string' 
                              ? (m.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                              : m.mediaType || 'image';
                            return mediaType === 'video';
                          }).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  // Placeholder when no media
                  <div className="p-8 border-2 border-dashed border-gray-300 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex space-x-2 mb-3">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                        <Video className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm font-medium mb-1">No Media Files Detected</p>
                      <p className="text-gray-400 text-xs">This job posting does not contain any images or videos</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Report Details */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-lg mb-4 text-gray-900">Report Details</h3>
                <div className="space-y-3 p-4 border-l-4 border-red-400 bg-red-50">
                  <p><strong>Reason:</strong> {formatReason(selectedPost.reason)}</p>
                  <p><strong>Comment:</strong> "{selectedPost.comment}"</p>
                  <p><strong>Reported by:</strong> {selectedPost.reportedBy.providerName} ({selectedPost.reportedBy.providerEmail})</p>
                  <p><strong>Report Date:</strong> {formatDate(selectedPost.createdAt)}</p>
                </div>
              </div>

              {/* Admin Notes */}
              {selectedPost.status === 'pending' ? (
                <div className="border-b border-gray-200 pb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Add your notes about this review decision..."
                  />
                </div>
              ) : selectedPost.adminNotes && (
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="font-semibold text-lg mb-4 text-gray-900">Admin Notes</h3>
                  <div className="p-4 border-l-4 border-gray-400">
                    <p className="text-gray-700">{selectedPost.adminNotes}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedPost.status === 'pending' && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleReviewPost(selectedPost._id, 'dismiss')}
                    disabled={actionLoading}
                    className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Dismiss Report
                  </button>
                  
                  <button
                    onClick={() => handleReviewPost(selectedPost._id, 'approve')}
                    disabled={actionLoading}
                    className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Keep Post
                  </button>
                  
                  <button
                    onClick={() => handleReviewPost(selectedPost._id, 'delete')}
                    disabled={actionLoading}
                    className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-5 w-5 mr-2" />
                    Delete Post
                  </button>
                </div>
              )}

              {actionLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Processing...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Alerts;