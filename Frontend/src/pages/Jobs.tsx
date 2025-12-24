import React, { useState, useEffect } from 'react';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};
import { 
  Search, 
  Eye,
  Trash2,
  EyeOff, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  Wallet,
  Calendar,
  AlertCircle,
  Users,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';
import UserTypeBadge from '../components/UI/UserTypeBadge';

interface Application {
  _id: string;
  provider: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: Date | string;
  message?: string;
}

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
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    location?: string;
    barangay?: string;
    city?: string;
    isVerified?: boolean;
    userType?: 'client' | 'provider';
    profileImage?: string;
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
  applications?: Application[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
}

const JobDetailsModal: React.FC<JobModalProps> = ({ isOpen, onClose, job }) => {
  const [showMediaAttachments, setShowMediaAttachments] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  useEffect(() => {
    if (isOpen && job) {
      fetchApplicants();
    }
  }, [isOpen, job]);

  const fetchApplicants = async () => {
    if (!job) return;
    
    try {
      setLoadingApplicants(true);
      const response = await fetch(`/api/jobs/${job._id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setApplicants(data.applications || []);
      }
    } catch (error) {
      console.error('Failed to fetch applicants:', error);
    } finally {
      setLoadingApplicants(false);
    }
  };
  
  if (!isOpen || !job) return null;

  console.log('Job data in modal:', job);
  console.log('Job budget:', job.budget, typeof job.budget);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const getInitials = (name: string): string => {
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    return nameParts[0][0].toUpperCase();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Job ID copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy Job ID');
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed right-0 top-0 h-full w-full md:w-[550px] bg-gray-50 z-50 shadow-2xl flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <button
                    onClick={() => copyToClipboard(job._id)}
                    className="text-xs text-gray-500 hover:text-blue-600 cursor-pointer transition-colors text-left"
                    title="Click to copy"
                  >
                    Job ID: {job._id}
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 inline">Job Title: </p>
                  <p className="text-base font-semibold text-gray-900 inline">{job.title}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div className="flex items-center gap-4 pb-6">
              {job.user?.profileImage ? (
                <img
                  src={job.user.profileImage}
                  alt={job.user.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-gray-700">
                    {getInitials(job.user?.name || 'U')}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-900 mb-1">{job.user?.name || 'Unknown User'}</h4>
                {(job.user?.firstName || job.user?.lastName) && (
                  <p className="text-sm text-gray-600 mb-1">
                    {job.user?.firstName || ''} {job.user?.lastName || ''}
                  </p>
                )}
                <p className="text-sm text-gray-600 inline">Email: </p>
                <p className="text-sm text-gray-900 inline">{job.user?.email || 'No email'}</p>
                <p className="text-sm text-gray-900 mt-1">KYD:{job.user?._id?.slice(-6) || '000000'}</p>
              </div>
              <div className="flex flex-col gap-2">
                <VerificationStatusBadge isVerified={job.user?.isVerified || false} />
                <UserTypeBadge userType={job.user?.userType || 'client'} />
              </div>
            </div>

            <div className="border-t border-gray-300 -mx-6" />
            <div className="flex -mx-6">
              <div className="flex-1 py-6 px-6">
                <p className="text-base font-semibold text-gray-900 mb-2">Budget:</p>
                <p className="text-base text-gray-700">{job.budget ? formatCurrency(job.budget) : 'Not specified'}</p>
              </div>
              <div className="border-l border-gray-300 flex-1 py-6 pl-4 pr-6">
                <p className="text-base font-semibold text-gray-900 mb-2">Applicants:</p>
                <p className="text-base text-gray-700">{job.applicationCount || 0}</p>
              </div>
            </div>
            <div className="border-t border-gray-300 -mx-6" />

            <div className="mb-6 mt-6">
              <p className="text-base font-semibold text-gray-900 mb-3">Contact Information:</p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Address</p>
                  <p className="text-sm text-gray-900">{job.locationDisplay || 'Location not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Brgy#</p>
                  <p className="text-sm text-gray-900">{job.user?.barangay || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">City</p>
                  <p className="text-sm text-gray-900">{job.user?.city || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone #</p>
                  <p className="text-sm text-gray-900">{job.user?.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Job Posted On:</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(job.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Category:</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{job.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Budget:</p>
                <p className="text-sm font-medium text-gray-900">{job.budget ? formatCurrency(job.budget) : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Method:</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{job.paymentMethod}</p>
              </div>
            </div>

            <div className="border-t border-gray-300 mb-6 -mx-6" />

            <div>
              <button
                onClick={() => setShowMediaAttachments(!showMediaAttachments)}
                className="w-full flex items-center justify-between text-base font-semibold text-gray-900 mb-3 hover:text-gray-700 transition-colors"
              >
                <span>Media Attachments ({job.media && job.media.length > 0 ? job.media.length : 0})</span>
                {showMediaAttachments ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              
              {showMediaAttachments && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {job.media && job.media.length > 0 ? (
                    job.media.map((url, index) => (
                      <div 
                        key={index} 
                        className="aspect-video border border-gray-300 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group relative"
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img
                          src={url}
                          alt={`Job media ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                          <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-sm text-gray-500">
                      No media attachments
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-300 mb-6 mt-6 -mx-6" />

            <div>
              <button
                onClick={() => setShowApplicants(!showApplicants)}
                className="w-full flex items-center justify-between text-base font-semibold text-gray-900 mb-3 hover:text-gray-700 transition-colors"
              >
                <span>Applicants ({applicants.length})</span>
                {showApplicants ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              
              {showApplicants && (
                <div className="mt-3">
                  {loadingApplicants ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : applicants.length > 0 ? (
                    <div className="space-y-3">
                      {applicants.map((application) => (
                        <div 
                          key={application._id} 
                          className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-semibold text-blue-700">
                                  {getInitials(application.provider?.name || 'P')}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {application.provider?.name || 'Unknown Provider'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {application.provider?.email || 'No email'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                application.status === 'accepted'
                                  ? 'bg-green-100 text-green-700'
                                  : application.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                            </span>
                          </div>
                          
                          {application.provider?.phone && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-500">Phone:</p>
                              <p className="text-sm text-gray-900">{application.provider.phone}</p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                              Applied {formatDistanceToNow(new Date(application.appliedAt), { addSuffix: true })}
                            </p>
                            {application.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    // Handle accept application
                                    console.log('Accept application:', application._id);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => {
                                    // Handle reject application
                                    console.log('Reject application:', application._id);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      No applicants yet
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-300 p-6 bg-gray-50">
          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Hide
            </button>
            <button
              className="flex-1 px-4 py-3 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
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
        console.log('Fetched jobs from API:', data.jobs);
        console.log('First job budget:', data.jobs[0]?.budget);
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
    setTimeout(() => setSelectedJob(null), 300);
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
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">{pagination.total} total jobs</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
            className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
            className="hidden md:block px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
          >
            <option value="all">All Payment Methods</option>
            <option value="wallet">Wallet</option>
            <option value="cash">Cash</option>
            <option value="xendit">Xendit</option>
          </select>

          <select
            value={urgentFilter}
            onChange={(e) => setUrgentFilter(e.target.value)}
            className="hidden md:block px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
            <div className="hidden md:block bg-white overflow-hidden">
              <table className="min-w-full w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[25%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="w-[20%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="w-[15%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="w-[15%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[12%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Applications
                    </th>
                    <th className="w-[13%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Posted
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {jobs.map((job, index) => (
                    <React.Fragment key={job._id}>
                    <tr 
                      onClick={() => openJobModal(job)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
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
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {job.user?.profileImage ? (
                            <img
                              src={job.user.profileImage}
                              alt={job.user.name}
                              className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-gray-700">
                                {getInitials(job.user?.name || 'Unknown')}
                              </span>
                            </div>
                          )}
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
                          <p className="text-sm font-bold text-gray-900">{job.budget ? formatCurrency(job.budget) : '₱NaN'}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Wallet className="h-3 w-3" />
                            <span className="capitalize">{job.paymentMethod}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                            <span className="capitalize">{job.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">{job.applicationCount || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {index < jobs.length - 1 && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div className="border-b border-gray-200" />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden px-4 py-4 space-y-3">
              {jobs.map((job) => (
                <div key={job._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{job.title}</h3>
                          {job.isUrgent && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 flex-shrink-0">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{job.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                            {job.category}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                            <span className="capitalize">{job.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {job.user?.profileImage ? (
                            <img
                              src={job.user.profileImage}
                              alt={job.user.name}
                              className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-gray-700">
                                {getInitials(job.user?.name || 'Unknown')}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {job.user?.name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {job.user?.email || 'No email'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-600 truncate flex-1">
                          {job.locationDisplay || 'Selected Location'}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <p className="text-xs font-semibold text-gray-900">
                            {formatCurrency(job.budget)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-xs font-medium text-gray-700">{job.applicationCount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 capitalize">{job.paymentMethod}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500 capitalize">{job.serviceTier} Tier</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.status === 'open' && (
                          <>
                            <button
                              onClick={() => updateJobStatus(job._id, 'in_progress')}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Mark as in progress"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => updateJobStatus(job._id, 'cancelled')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancel job"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {job.status === 'in_progress' && (
                          <button
                            onClick={() => updateJobStatus(job._id, 'completed')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Mark as completed"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openJobModal(job)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="bg-white px-4 md:px-6 py-4 border-t border-gray-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-700 text-center md:text-left">
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
                      className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
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

      <JobDetailsModal
        isOpen={jobModal.isOpen}
        onClose={closeJobModal}
        job={selectedJob}
      />

      {/* Image Lightbox Modal */}
      {selectedJob && selectedJob.media && selectedJob.media.length > 0 && selectedImageIndex !== null && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-90 z-[60] transition-opacity"
            onClick={() => setSelectedImageIndex(null)}
          />
          
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 bg-black bg-opacity-50 rounded-full"
              aria-label="Close image viewer"
            >
              <X className="w-6 h-6" />
            </button>

            {selectedJob.media.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => 
                      prev === 0 ? selectedJob.media.length - 1 : prev! - 1
                    );
                  }}
                  className="absolute left-4 text-white hover:text-gray-300 transition-colors p-3 bg-black bg-opacity-50 rounded-full"
                  aria-label="Previous image"
                >
                  <ChevronDown className="w-6 h-6 rotate-90" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => 
                      prev === selectedJob.media.length - 1 ? 0 : prev! + 1
                    );
                  }}
                  className="absolute right-4 text-white hover:text-gray-300 transition-colors p-3 bg-black bg-opacity-50 rounded-full"
                  aria-label="Next image"
                >
                  <ChevronDown className="w-6 h-6 -rotate-90" />
                </button>
              </>
            )}

            <div className="max-w-7xl max-h-full w-full h-full flex items-center justify-center">
              <img
                src={selectedJob.media[selectedImageIndex]}
                alt={`Job media ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">
              {selectedImageIndex + 1} / {selectedJob.media.length}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Jobs;