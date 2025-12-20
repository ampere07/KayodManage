import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Eye, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Flag,
  Search,
  Image as ImageIcon,
  Video
} from 'lucide-react';
import { formatBudgetWithType } from '../utils/currency';
import SideModal from '../components/SideModal';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      
      setReportedPosts(prev => 
        prev.map(post => 
          post._id === postId 
            ? { ...post, ...result.reportedPost, status: result.reportedPost.status }
            : post
        )
      );

      setIsModalOpen(false);
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
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
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
                  setFilter(tab.key as any);
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
                  {paginatedPosts.map((post, index) => (
                    <React.Fragment key={post._id}>
                      <tr className="hover:bg-gray-50 transition-colors">
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
                  ))}
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

      {/* Side Modal */}
      <SideModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Review Reported Post"
        width="2xl"
      >
        {selectedPost && (
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <span className="text-sm text-gray-600">Current Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedPost.status)}`}>
                {selectedPost.status.charAt(0).toUpperCase() + selectedPost.status.slice(1)}
              </span>
            </div>

            {/* Job Details */}
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-900">Job Details</h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Title:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.jobId.title}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Description:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.jobId.description}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Category:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.jobId.category}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Budget:</span>
                  <span className="col-span-2 text-gray-900">{formatBudgetWithType(selectedPost.jobId.budget, selectedPost.jobId.budgetType)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Payment:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.jobId.paymentMethod}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Location:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.jobId.location.address}, {selectedPost.jobId.location.city}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600 font-medium">Posted:</span>
                  <span className="col-span-2 text-gray-900">{formatDate(selectedPost.jobId.createdAt)}</span>
                </div>
                {selectedPost.jobId.isDeleted && (
                  <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-400 flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm font-medium">This job has been deleted</p>
                  </div>
                )}
              </div>
            </div>

            {/* Job Media */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-lg mb-3 text-gray-900">
                Job Media
                {selectedPost.jobId.media && selectedPost.jobId.media.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({selectedPost.jobId.media.length} file{selectedPost.jobId.media.length !== 1 ? 's' : ''})
                  </span>
                )}
              </h3>
              
              {selectedPost.jobId.media && selectedPost.jobId.media.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectedPost.jobId.media.map((mediaItem, index) => {
                    const mediaUrl = typeof mediaItem === 'string' ? mediaItem : mediaItem.type;
                    const mediaType = typeof mediaItem === 'string' 
                      ? (mediaUrl.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')
                      : mediaItem.mediaType || 'image';
                    const fileName = typeof mediaItem === 'string'
                      ? mediaUrl.split('/').pop() || 'Unknown file'
                      : mediaItem.originalName || 'Unknown file';
                    
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                        </div>
                        
                        {mediaType === 'image' ? (
                          <img
                            src={mediaUrl}
                            alt={fileName}
                            className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(mediaUrl, '_blank')}
                          />
                        ) : (
                          <video
                            src={mediaUrl}
                            className="w-full h-24 object-cover rounded border"
                            controls
                            preload="metadata"
                          />
                        )}
                        
                        <div className="mt-2">
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No media files</p>
                </div>
              )}
            </div>

            {/* Report Details */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-lg mb-3 text-gray-900">Report Details</h3>
              <div className="p-4 border-l-4 border-red-400 bg-red-50 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-700 font-medium">Reason:</span>
                  <span className="col-span-2 text-gray-900">{formatReason(selectedPost.reason)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-700 font-medium">Comment:</span>
                  <span className="col-span-2 text-gray-900">"{selectedPost.comment}"</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-700 font-medium">Reported by:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.reportedBy.providerName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-700 font-medium">Email:</span>
                  <span className="col-span-2 text-gray-900">{selectedPost.reportedBy.providerEmail}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-700 font-medium">Report Date:</span>
                  <span className="col-span-2 text-gray-900">{formatDate(selectedPost.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            {selectedPost.status === 'pending' ? (
              <div className="border-t border-gray-200 pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add your notes about this review decision..."
                />
              </div>
            ) : selectedPost.adminNotes && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-lg mb-3 text-gray-900">Admin Notes</h3>
                <div className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded">
                  <p className="text-gray-700 text-sm">{selectedPost.adminNotes}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedPost.status === 'pending' && (
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleReviewPost(selectedPost._id, 'dismiss')}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Dismiss
                </button>
                
                <button
                  onClick={() => handleReviewPost(selectedPost._id, 'approve')}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Keep Post
                </button>
                
                <button
                  onClick={() => handleReviewPost(selectedPost._id, 'delete')}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Post
                </button>
              </div>
            )}

            {actionLoading && (
              <div className="flex items-center justify-center py-4 border-t border-gray-200">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 text-sm">Processing...</span>
              </div>
            )}
          </div>
        )}
      </SideModal>
    </div>
  );
};

export default Alerts;
