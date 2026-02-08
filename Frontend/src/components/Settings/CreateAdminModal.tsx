import React, { useState } from 'react';
import SideModal from '../SideModal';
import { settingsService } from '../../services';
import { User, Shield, ChevronDown, BarChart3, DollarSign, Settings } from 'lucide-react';

interface CreateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AdminFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
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

type TabType = 'basic' | 'permissions';

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

const CreateAdminModal: React.FC<CreateAdminModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [formData, setFormData] = useState<AdminFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
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

  const applyPermissionTemplate = (template: 'full' | 'admin' | 'finance' | 'support') => {
    let permissions;

    switch (template) {
      case 'full':
        permissions = {
          dashboard: true,
          users: true,
          jobs: true,
          transactions: true,
          verifications: true,
          support: true,
          activity: true,
          flagged: true,
          settings: true
        };
        break;
      case 'admin':
        permissions = {
          dashboard: true,
          users: true,
          jobs: true,
          transactions: false,
          verifications: true,
          support: false,
          activity: true,
          flagged: true,
          settings: false
        };
        break;
      case 'finance':
        permissions = {
          dashboard: true,
          users: false,
          jobs: false,
          transactions: true,
          verifications: false,
          support: true,
          activity: true,
          flagged: false,
          settings: false
        };
        break;
      case 'support':
        permissions = {
          dashboard: true,
          users: true,
          jobs: true,
          transactions: false,
          verifications: true,
          support: true,
          activity: false,
          flagged: true,
          settings: false
        };
        break;
    }

    setFormData(prev => ({
      ...prev,
      permissions
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.phone || !formData.location) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);

      const adminData = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        userType: formData.userType,
        location: formData.location,
        accountStatus: formData.accountStatus,
        permissions: formData.permissions
      };

      await settingsService.createAdmin(adminData);

      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
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
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'permissions', label: 'Permissions', icon: Shield }
  ];

  return (
    <SideModal isOpen={isOpen} onClose={onClose} title="Create New Admin" width="4xl">
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
                  className={`flex items-center gap-2 px-3 md:px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
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
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
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
                      onClick={() => applyPermissionTemplate('full')}
                      className="p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-gray-300"
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
                      onClick={() => applyPermissionTemplate('admin')}
                      className="p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-gray-300"
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
                      onClick={() => applyPermissionTemplate('finance')}
                      className="p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-gray-300"
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
                      onClick={() => applyPermissionTemplate('support')}
                      className="p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-gray-300"
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
          </div>

          <div className="sticky bottom-0 z-10 flex flex-row justify-end gap-2 px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 overflow-x-auto no-scrollbar">
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
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Admin</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </SideModal>
  );
};

export default CreateAdminModal;
