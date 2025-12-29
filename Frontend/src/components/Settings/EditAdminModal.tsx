import React, { useState, useEffect } from 'react';
import SideModal from '../SideModal';
import { settingsService } from '../../services';

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
  newPassword: string;
  confirmPassword: string;
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

const EditAdminModal: React.FC<EditAdminModalProps> = ({ isOpen, onClose, onSuccess, admin }) => {
  const [formData, setFormData] = useState<AdminFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    userType: 'admin',
    location: '',
    newPassword: '',
    confirmPassword: '',
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
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  useEffect(() => {
    if (admin && isOpen) {
      fetchAdminDetails(admin._id);
    }
  }, [admin, isOpen]);

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
        newPassword: '',
        confirmPassword: '',
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
      setShowPasswordFields(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin details');
    } finally {
      setLoadingData(false);
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

  const handleSelectAll = () => {
    const allSelected = Object.values(formData.permissions).every(val => val);
    setFormData(prev => ({
      ...prev,
      permissions: Object.keys(prev.permissions).reduce((acc, key) => ({
        ...acc,
        [key]: !allSelected
      }), {} as typeof formData.permissions)
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

    if (showPasswordFields && formData.newPassword) {
      if (formData.newPassword.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    try {
      setLoading(true);
      
      const adminData: any = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        userType: formData.userType,
        location: formData.location,
        permissions: formData.permissions
      };

      if (showPasswordFields && formData.newPassword) {
        adminData.newPassword = formData.newPassword;
      }
      
      await settingsService.updateAdmin(admin._id, adminData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update admin');
    } finally {
      setLoading(false);
    }
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

  return (
    <SideModal isOpen={isOpen} onClose={onClose} title="Edit Admin" width="lg">
      {loadingData ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading admin data...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
                placeholder="Admin Office"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Change Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordFields(!showPasswordFields);
                    if (showPasswordFields) {
                      setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showPasswordFields ? 'Cancel' : 'Change Password'}
                </button>
              </div>

              {showPasswordFields && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password (min 6 characters)"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="userType"
                value={formData.userType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
                <option value="customer support">Customer Support</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Permissions
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {Object.values(formData.permissions).every(val => val) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {permissionLabels.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center space-x-2 cursor-pointer p-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.permissions[key]}
                      onChange={() => handlePermissionChange(key)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Admin</span>
              )}
            </button>
          </div>
        </form>
      )}
    </SideModal>
  );
};

export default EditAdminModal;
