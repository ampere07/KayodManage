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
          transactions: true,
          verifications: true,
          support: true,
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
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
            {error && (
              <div className="mb-3 bg-red-50 border-l-4 border-red-400 text-red-700 px-3 py-2.5 rounded">
                <p className="text-xs md:text-sm">{error}</p>
              </div>
            )}

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="First name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="admin@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1234567890"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="accountStatus"
                      value={formData.accountStatus}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="banned">Banned</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Office location"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    Role Selection <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    {([
                      { value: 'superadmin',      label: 'Super Admin', desc: 'Full access',         border: 'border-green-500',  bg: 'bg-green-50',  dot: 'border-green-500 bg-green-500'   },
                      { value: 'admin',           label: 'Admin',       desc: 'Moderate access',     border: 'border-blue-500',   bg: 'bg-blue-50',   dot: 'border-blue-500 bg-blue-500'     },
                      { value: 'finance',         label: 'Finance',     desc: 'Financial data',      border: 'border-yellow-500', bg: 'bg-yellow-50', dot: 'border-yellow-500 bg-yellow-500' },
                      { value: 'customer support',label: 'Support',     desc: 'Customer service',    border: 'border-purple-500', bg: 'bg-purple-50', dot: 'border-purple-500 bg-purple-500' },
                    ] as { value: string; label: string; desc: string; border: string; bg: string; dot: string }[]).map(({ value, label, desc, border, bg, dot }) => {
                      const active = formData.userType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, userType: value }))}
                          className={`p-2.5 md:p-4 rounded-lg border-2 transition-all text-left ${active ? `${border} ${bg}` : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs md:text-sm font-semibold block mb-0.5 ${active ? 'text-gray-900' : 'text-gray-700'}`}>{label}</span>
                              <span className="text-[10px] md:text-xs text-gray-500 leading-tight">{desc}</span>
                            </div>
                            <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${active ? dot : 'border-gray-300'}`}>
                              {active && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="text-xs md:text-sm font-semibold text-gray-900 mb-2 md:mb-3 uppercase tracking-widest">Permission Templates</h3>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    {([
                      { tmpl: 'full' as const,    label: 'Full Access', desc: 'All permissions',        dotColor: 'bg-green-500'  },
                      { tmpl: 'admin' as const,   label: 'Admin',       desc: 'All except settings',    dotColor: 'bg-blue-500'   },
                      { tmpl: 'finance' as const, label: 'Finance',     desc: 'Dashboard, Transactions', dotColor: 'bg-yellow-500' },
                      { tmpl: 'support' as const, label: 'Support',     desc: 'Users, Jobs, Flagged',   dotColor: 'bg-purple-500' },
                    ]).map(({ tmpl, label, desc, dotColor }) => (
                      <button
                        key={tmpl}
                        type="button"
                        onClick={() => applyPermissionTemplate(tmpl)}
                        className="p-2.5 md:p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-gray-300"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 md:mb-1">
                          <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full ${dotColor} flex items-center justify-center flex-shrink-0`}>
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs md:text-sm font-semibold text-gray-900">{label}</span>
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-500 leading-tight">{desc}</p>
                      </button>
                    ))}
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

          <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-gray-50">
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
