import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  DollarSign,
  Calendar,
  AlertTriangle,
  Users,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Job {
  _id: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  media: string[];
  location?: any;
  locationDisplay: string;
  locationDetails?: string;
  date: Date | string;
  isUrgent: boolean;
  serviceTier: 'basic' | 'standard' | 'premium';
  paymentMethod: 'wallet' | 'cash' | 'xendit';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  budget: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  escrowAmount: number;
  paidAmount: number;
  paidAt?: Date | string;
  applicationCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
}

const JobDetailsModal: React.FC<JobModalProps> = ({ isOpen, onClose, job }) => {
  if (!isOpen || !job) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">{job.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{job.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Category:</span>
              <p className="text-sm text-gray-900 capitalize">{job.category}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Budget:</span>
              <p className="text-sm text-gray-900">{formatCurrency(job.budget)}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Location:</span>
              <p className="text-sm text-gray-900">{job.locationDisplay || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Payment Method:</span>
              <p className="text-sm text-gray-900 capitalize">{job.paymentMethod}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Client:</span>
              <p className="text-sm text-gray-900">{job.user?.name || 'Unknown User'}</p>
              <p className="text-xs text-gray-500">{job.user?.email || 'No email'}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Service Tier:</span>
              <p className="text-sm text-gray-900 capitalize">{job.serviceTier}</p>
            </div>
          </div>

          {job.assignedTo && (
            <div>
              <span className="text-sm font-medium text-gray-500">Assigned To:</span>
              <p className="text-sm text-gray-900">{job.assignedTo.name}</p>
              <p className="text-xs text-gray-500">{job.assignedTo.email}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-4">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                job.status === 'open' ? 'bg-blue-100 text-blue-800' :
                job.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                job.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {job.status.replace('_', ' ')}
              </span>
              {job.isUrgent && (
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                  Urgent
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Applications: {job.applicationCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [urgentFilter, setUrgentFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModal, setJobModal] = useState({ isOpen: false });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchJobs();
  }, [searchTerm, statusFilter, categoryFilter, paymentMethodFilter, urgentFilter, pagination.page]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(paymentMethodFilter !== 'all' && { paymentMethod: paymentMethodFilter }),
        ...(urgentFilter === 'true' && { isUrgent: 'true' })
      });

      const response = await fetch(`/api/jobs?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
        setPagination(prev => ({ ...prev, ...data.pagination }));
      } else {
        console.error('Failed to fetch jobs:', response.status);
        toast.error('Failed to load jobs');
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        const updatedJob = await response.json();
        setJobs(prev => prev.map(job => 
          job._id === jobId ? updatedJob : job
        ));
        toast.success(`Job status updated to ${status}`);
      }
    } catch (error) {
      console.error('Failed to update job status:', error);
      toast.error('Failed to update job status');
    }
  };

  const openJobModal = (job: Job) => {
    setSelectedJob(job);
    setJobModal({ isOpen: true });
  };

  const closeJobModal = () => {
    setJobModal({ isOpen: false });
    setSelectedJob(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const categories = [
    'carpentry', 'plumbing', 'electrical', 'cleaning', 'gardening', 
    'painting', 'appliance repair', 'moving', 'tutoring', 'beauty'
  ];

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">Job Management</h2>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">API Mode</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {pagination.total} total jobs
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchJobs}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category} className="capitalize">
                {category}
              </option>
            ))}
          </select>

          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Payment Methods</option>
            <option value="wallet">Wallet</option>
            <option value="cash">Cash</option>
            <option value="xendit">Xendit</option>
          </select>

          <select
            value={urgentFilter}
            onChange={(e) => setUrgentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Priority</option>
            <option value="true">Urgent Only</option>
            <option value="false">Normal Priority</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No jobs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applications
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Posted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {job.title}
                          </div>
                          {job.isUrgent && (
                            <span title="Urgent">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 truncate mt-1">
                          {job.description}
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="text-xs text-gray-400 capitalize">
                            {job.category}
                          </div>
                          <div className="flex items-center text-xs text-gray-400">
                            <MapPin className="h-3 w-3 mr-1" />
                            {job.locationDisplay || 'Not specified'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm text-gray-900">{job.user?.name || 'Unknown User'}</div>
                          <div className="text-xs text-gray-500">{job.user?.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(job.budget)}
                      </div>
                      <div className="text-xs text-gray-500 capitalize flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {job.paymentMethod}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(job.status)}
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 capitalize mt-1">
                        {job.serviceTier} tier
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Users className="h-4 w-4 mr-1 text-gray-400" />
                        {job.applicationCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </div>
                      <div className="flex items-center text-xs text-gray-400 mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(job.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {job.status === 'open' && (
                          <>
                            <button
                              onClick={() => updateJobStatus(job._id, 'in_progress')}
                              className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors"
                              aria-label="Mark as in progress"
                              title="Mark as in progress"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => updateJobStatus(job._id, 'cancelled')}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              aria-label="Cancel job"
                              title="Cancel job"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {job.status === 'in_progress' && (
                          <button
                            onClick={() => updateJobStatus(job._id, 'completed')}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            aria-label="Mark as completed"
                            title="Mark as completed"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openJobModal(job)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          aria-label="View details"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
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
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
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
