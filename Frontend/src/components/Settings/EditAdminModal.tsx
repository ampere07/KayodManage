import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SideModal from '../SideModal';
import { settingsService } from '../../services';
import { User, Shield, Lock, Activity as ActivityIcon, ChevronDown, BarChart3, DollarSign, Settings } from 'lucide-react';

interface EditAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  admin: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
    permissions: {
      dashboard: boolean;
      users: boolean;
      jobs: boolean;
      transactions: boolean;
      verifications: boolean;
      support: boolean;
      activity: boolean;
      flagged: boolean;
      settings: boolean;
    };
  } | null;
}

interface AdminFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userType: string;
  location: string;
  accountStatus: string;
  permissions: {
    dashboard: boolean;
    users: boolean;
    jobs: boolean;
    transactions: boolean;
    verifications: boolean;
    support: boolean;
    activity: boolean;
    flagged: boolean;
    settings: boolean;
  };
}

type TabType = 'basic' | 'permissions' | 'security' | 'activity';

interface PermissionSectionProps {
  title: string;
  icon: React.ElementType;
  permissions: { key: keyof AdminFormData['permissions']; label: string }[];
  formData: AdminFormData;
  onPermissionChange: (permission: keyof AdminFormData['permissions']) => void;
}

const PermissionSection: React.FC<PermissionSectionProps> = ({ title, icon: Icon, permissions, formData, onPermissionChange }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-700" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''
          }`} />
      </button>
      {isExpanded && (
        <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4">
          {permissions.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={formData.permissions[key]}
                onChange={() => onPermissionChange(key)}
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-900">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const EditAdminModal: React.FC<EditAdminModalProps> = ({ isOpen, onClose, onSuccess, admin }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [formData, setFormData] = useState<AdminFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    userType: 'admin',
    location: '',
    accountStatus: 'active',
    permissions: {
      dashboard: false,
      users: false,
      jobs: false,
      transactions: false,
      verifications: false,
      support: false,
      activity: false,
      flagged: false,
      settings: false
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [displayCount, setDisplayCount] = useState(15);
  const [adminUid, setAdminUid] = useState<string>('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (admin && isOpen) {
      fetchAdminDetails(admin._id);
      fetchAdminActivity(admin._id);
      setAdminUid(admin._id ? `KYD-${admin._id.toString().slice(-6).toUpperCase()}` : '');
      setActiveTab('basic');
    }
  }, [admin, isOpen]);

  useEffect(() => {
    if (activeTab === 'security' && admin?._id && isOpen) {
      fetchAdminSessions(admin._id);
    }
  }, [activeTab, admin?._id, isOpen]);

  useEffect(() => {
    if (activeTab === 'activity' && admin?._id && isOpen) {
      setDisplayCount(15);
    }
  }, [activeTab, admin?._id, isOpen]);

  const fetchAdminDetails = async (adminId: string) => {
    try {
      setLoadingData(true);
      const response = await settingsService.getAdminById(adminId);
      const adminData = response.admin;

      const nameParts = adminData.name ? adminData.name.split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setFormData({
        firstName,
        lastName,
        email: adminData.email || '',
        phone: adminData.phone || '',
        userType: adminData.userType || 'admin',
        location: adminData.location || '',
        accountStatus: adminData.accountStatus || 'active',
        permissions: adminData.permissions || {
          dashboard: false,
          users: false,
          jobs: false,
          transactions: false,
          verifications: false,
          support: false,
          activity: false,
          flagged: false,
          settings: false
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load admin details');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchAdminActivity = async (adminId: string) => {
    try {
      setLoadingActivities(true);
      const response = await settingsService.getAdminActivity(adminId, 1000, 0);
      setActivities(response.activities || []);
    } catch (err: any) {
      console.error('Error fetching admin activity:', err);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchAdminSessions = async (adminId: string) => {
    try {
      setLoadingSessions(true);
      const response = await settingsService.getAdminSessions(adminId);
      setSessions(response.sessions || []);
    } catch (err: any) {
      console.error('Error fetching admin sessions:', err);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 15);
  };

  const handleActivityClick = (activity: any) => {
    // Close the modal first
    onClose();

    // Navigate to the Activity page with the specific activity log ID
    const activityId = activity._id;

    if (activityId) {
      navigate(`/activity?id=${activityId}`);
    } else {
      navigate('/activity');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (permission: keyof typeof formData.permissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!admin) return;

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.location) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const adminData: any = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        userType: formData.userType,
        location: formData.location,
        accountStatus: formData.accountStatus,
        permissions: formData.permissions
      };

      await settingsService.updateAdmin(admin._id, adminData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update admin');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string): string => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}`;
  };

  const permissionLabels: { key: keyof typeof formData.permissions; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Users' },
    { key: 'jobs', label: 'Jobs' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'verifications', label: 'Verifications' },
    { key: 'support', label: 'Support' },
    { key: 'activity', label: 'Activity' },
    { key: 'flagged', label: 'Flagged' },
    { key: 'settings', label: 'Settings' }
  ];

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'activity', label: 'Activity', icon: ActivityIcon }
  ];

  return (
    <SideModal
      isOpen={isOpen}
      onClose={onClose}
      width="4xl"
      headerContent={
        !loadingData ? (
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-semibold">
                {getInitials(formData.firstName, formData.lastName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit {formData.firstName} {formData.lastName}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{adminUid}</p>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-gray-900">Edit Admin</h2>
        )
      }
    >
      {loadingData ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading admin data...</span>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Tabs */}
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex px-4 md:px-6 overflow-x-auto scrollbar-hide no-scrollbar">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-2 md:px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="md:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="First name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="admin@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1234567890"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Office location"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="accountStatus"
                      value={formData.accountStatus}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="banned">Banned</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Role Selection <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'superadmin' }))}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${formData.userType === 'superadmin'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`text-sm font-semibold block mb-1 ${formData.userType === 'superadmin'
                              ? 'text-gray-900'
                              : 'text-gray-700'
                              }`}>
                              Super Admin
                            </span>
                            <span className="text-xs text-gray-600">
                              Full access to all features
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${formData.userType === 'superadmin'
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-300'
                            }`}>
                            {formData.userType === 'superadmin' && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'admin' }))}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${formData.userType === 'admin'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`text-sm font-semibold block mb-1 ${formData.userType === 'admin'
                              ? 'text-gray-900'
                              : 'text-gray-700'
                              }`}>
                              Admin
                            </span>
                            <span className="text-xs text-gray-600">
                              Moderate access & management
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${formData.userType === 'admin'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                            }`}>
                            {formData.userType === 'admin' && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'finance' }))}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${formData.userType === 'finance'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`text-sm font-semibold block mb-1 ${formData.userType === 'finance'
                              ? 'text-gray-900'
                              : 'text-gray-700'
                              }`}>
                              Finance
                            </span>
                            <span className="text-xs text-gray-600">
                              Financial data & transactions
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${formData.userType === 'finance'
                            ? 'border-yellow-500 bg-yellow-500'
                            : 'border-gray-300'
                            }`}>
                            {formData.userType === 'finance' && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, userType: 'customer support' }))}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${formData.userType === 'customer support'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`text-sm font-semibold block mb-1 ${formData.userType === 'customer support'
                              ? 'text-gray-900'
                              : 'text-gray-700'
                              }`}>
                              Support
                            </span>
                            <span className="text-xs text-gray-600">
                              Customer service & assistance
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${formData.userType === 'customer support'
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-300'
                            }`}>
                            {formData.userType === 'customer support' && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Permissions Tab */}
              {activeTab === 'permissions' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">PERMISSION TEMPLATES</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            permissions: {
                              dashboard: true,
                              users: true,
                              jobs: true,
                              transactions: true,
                              verifications: true,
                              support: true,
                              activity: true,
                              flagged: true,
                              settings: true
                            }
                          }));
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${Object.values(formData.permissions).every(val => val)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Full Access</span>
                        </div>
                        <p className="text-xs text-gray-600">All permissions enabled</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            permissions: {
                              dashboard: true,
                              users: true,
                              jobs: true,
                              transactions: false,
                              verifications: true,
                              support: false,
                              activity: true,
                              flagged: true,
                              settings: false
                            }
                          }));
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${formData.permissions.dashboard === true &&
                          formData.permissions.users === true &&
                          formData.permissions.jobs === true &&
                          formData.permissions.transactions === false &&
                          formData.permissions.verifications === true &&
                          formData.permissions.support === false &&
                          formData.permissions.activity === true &&
                          formData.permissions.flagged === true &&
                          formData.permissions.settings === false
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Admin</span>
                        </div>
                        <p className="text-xs text-gray-600">Dashboard, Users, Jobs, Verifications, Activity, Flagged</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            permissions: {
                              dashboard: true,
                              users: false,
                              jobs: false,
                              transactions: true,
                              verifications: false,
                              support: true,
                              activity: true,
                              flagged: false,
                              settings: false
                            }
                          }));
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${formData.permissions.dashboard === true &&
                          formData.permissions.users === false &&
                          formData.permissions.jobs === false &&
                          formData.permissions.transactions === true &&
                          formData.permissions.verifications === false &&
                          formData.permissions.support === true &&
                          formData.permissions.activity === true &&
                          formData.permissions.flagged === false &&
                          formData.permissions.settings === false
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Finance</span>
                        </div>
                        <p className="text-xs text-gray-600">Dashboard, Transactions, Support, Activity</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            permissions: {
                              dashboard: true,
                              users: true,
                              jobs: true,
                              transactions: false,
                              verifications: true,
                              support: true,
                              activity: false,
                              flagged: true,
                              settings: false
                            }
                          }));
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${formData.permissions.dashboard === true &&
                          formData.permissions.users === true &&
                          formData.permissions.jobs === true &&
                          formData.permissions.transactions === false &&
                          formData.permissions.verifications === true &&
                          formData.permissions.support === true &&
                          formData.permissions.activity === false &&
                          formData.permissions.flagged === true &&
                          formData.permissions.settings === false
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Support</span>
                        </div>
                        <p className="text-xs text-gray-600">Dashboard, Users, Jobs, Verifications, Support, Flagged</p>
                      </button>
                    </div>
                  </div>

                  <PermissionSection
                    title="Core Access"
                    icon={BarChart3}
                    permissions={[
                      { key: 'dashboard', label: 'Dashboard' },
                      { key: 'users', label: 'Users' },
                      { key: 'jobs', label: 'Jobs' }
                    ]}
                    formData={formData}
                    onPermissionChange={handlePermissionChange}
                  />

                  <PermissionSection
                    title="Financial"
                    icon={DollarSign}
                    permissions={[
                      { key: 'transactions', label: 'Transactions' },
                      { key: 'verifications', label: 'Verifications' }
                    ]}
                    formData={formData}
                    onPermissionChange={handlePermissionChange}
                  />

                  <PermissionSection
                    title="Support & Moderation"
                    icon={Shield}
                    permissions={[
                      { key: 'support', label: 'Support' },
                      { key: 'flagged', label: 'Flagged Items' }
                    ]}
                    formData={formData}
                    onPermissionChange={handlePermissionChange}
                  />

                  <PermissionSection
                    title="Administrative"
                    icon={Settings}
                    permissions={[
                      { key: 'activity', label: 'Activity Logs' },
                      { key: 'settings', label: 'Settings' }
                    ]}
                    formData={formData}
                    onPermissionChange={handlePermissionChange}
                  />
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  {/* Security Notice Banner */}
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-800">
                          <span className="font-semibold">Security Notice:</span> This admin does not have 2FA enabled. We strongly recommend enabling two-factor authentication for enhanced security.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-base font-semibold text-gray-900">Two-Factor Authentication</h3>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Require this admin to use 2FA when logging in. This adds an extra layer of security to protect their account.
                    </p>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Send Setup Instructions
                    </button>
                  </div>

                  {/* Password Management */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-base font-semibold text-gray-900">Password Management</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Last password change: <span className="font-medium">45 days ago</span>
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Force Password Reset
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Send Reset Email
                      </button>
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-base font-semibold text-gray-900">Active Sessions</h3>
                    </div>
                    {loadingSessions ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-sm text-gray-600">Loading sessions...</span>
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-gray-600 mb-3">No active sessions found</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 mb-3">{sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}:</p>
                        <ul className="space-y-2 mb-4">
                          {sessions.map((session) => (
                            <li key={session._id} className="text-sm text-gray-700">
                              • {session.device}{session.isCurrent ? ' (Current)' : ''} - {session.location}
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Revoke All Sessions
                        </button>
                      </>
                    )}
                  </div>

                  {/* Session Timeout */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-base font-semibold text-gray-900">Session Timeout</h3>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600">
                      Automatically log this admin out after 30 minutes of inactivity
                    </p>
                  </div>
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  {/* Activity Notice */}
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-800">
                          <span className="font-semibold">Activity Log:</span> Showing recent actions performed by this admin.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Activity Timeline */}
                  {loadingActivities ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading activities...</span>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                      <ActivityIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600">No recent activities found</p>
                      <p className="text-xs text-gray-500 mt-1">Activity will appear here once this admin performs actions</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline container */}
                      <div className="space-y-0">
                        {activities.slice(0, displayCount).map((activity, index) => (
                          <div key={activity._id || index} className="relative flex gap-4">
                            {/* Timeline dot and line */}
                            <div className="flex flex-col items-center pt-2">
                              <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></div>
                              {index < Math.min(displayCount, activities.length) - 1 && (
                                <div className="w-0.5 flex-1 bg-gray-200 mt-1"></div>
                              )}
                            </div>

                            {/* Activity content */}
                            <button
                              onClick={() => handleActivityClick(activity)}
                              className="flex-1 text-left hover:bg-gray-100 rounded-lg transition-colors p-4 mb-4"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="text-sm font-semibold text-gray-900">{activity.action || 'Activity'}</h4>
                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{activity.timeAgo || 'Recently'}</span>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-gray-600 mb-1">{activity.description}</p>
                              )}
                              {activity.details && (
                                <p className="text-sm text-gray-600">{activity.details}</p>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Load More Button */}
                  {displayCount < activities.length && (
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        Show More Activities ({activities.length - displayCount} remaining)
                      </button>
                    </div>
                  )}

                  {displayCount >= activities.length && activities.length > 15 && (
                    <div className="pt-4 text-center text-sm text-gray-500">
                      Showing all {activities.length} activities
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="sticky bottom-0 z-10 border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-row items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this admin? This action cannot be undone.')) {
                      // Delete logic
                    }
                  }}
                  className="px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-xs md:text-sm font-medium flex-shrink-0"
                >
                  Delete Admin
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </SideModal>
  );
};

export default EditAdminModal;
