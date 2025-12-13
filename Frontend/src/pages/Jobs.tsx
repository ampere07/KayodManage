import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  Wallet,
  Calendar,
  AlertCircle,
  Users
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
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
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
        return <AlertCircle className="h-4 w-4" />;
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
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="text-sm text-gray-500 mt-1">{pagination.total} total jobs</p>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-600">Complete</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-gray-600">Cancel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-gray-600">View</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
          >
            <option value="all">All Payment Methods</option>
            <option value="wallet">Wallet</option>
            <option value="cash">Cash</option>
            <option value="xendit">Xendit</option>
          </select>

          <select
            value={urgentFilter}
            onChange={(e) => setUrgentFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
          >
            <option value="all">All Priority</option>
            <option value="true">Urgent Only</option>
            <option value="false">Normal Priority</option>
          </select>
        </div>
      </div>

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
            <div className="bg-white overflow-hidden">
              <table className="min-w-full w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[30%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Job Details
                    </th>
                    <th className="w-[15%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="w-[12%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="w-[12%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[10%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Applications
                    </th>
                    <th className="w-[11%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Posted
                    </th>
                    <th className="w-[10%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {jobs.map((job, index) => (
                    <React.Fragment key={job._id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                            {job.isUrgent && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1">{job.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                            <span className="capitalize font-medium">{job.category}</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.locationDisplay || 'Selected Location'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {job.user?.name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {job.user?.email || 'No email'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(job.budget)}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Wallet className="h-3 w-3" />
                            <span className="capitalize">{job.paymentMethod}</span>
                          </div>
                          <p className="text-xs text-gray-500 capitalize">{job.serviceTier} Tier</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                            <span className="capitalize">{job.status.replace('_', ' ')}</span>
                          </span>
                          <p className="text-xs text-gray-500 capitalize">{job.serviceTier} Tier</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">{job.applicationCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {job.status === 'open' && (
                            <>
                              <button
                                onClick={() => updateJobStatus(job._id, 'in_progress')}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                title="Mark as in progress"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => updateJobStatus(job._id, 'cancelled')}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Cancel job"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {job.status === 'in_progress' && (
                            <button
                              onClick={() => updateJobStatus(job._id, 'completed')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Mark as completed"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openJobModal(job)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {index < jobs.length - 1 && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="border-b border-gray-200" />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="bg-white px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

      <JobDetailsModal
        isOpen={jobModal.isOpen}
        onClose={closeJobModal}
        job={selectedJob}
      />
    </div>
  );
};

export default Jobs;
