import React, { useState, useEffect } from 'react';
import { UserPlus, ShieldAlert, Edit2, XCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { settingsService } from '../services';
import CreateAdminModal from '../components/Settings/CreateAdminModal';
import EditAdminModal from '../components/Settings/EditAdminModal';

interface Permission {
  dashboard: boolean;
  users: boolean;
  jobs: boolean;
  transactions: boolean;
  verifications: boolean;
  support: boolean;
  activity: boolean;
  flagged: boolean;
  settings: boolean;
}

interface Admin {
  _id: string;
  uid: string;
  fullName: string;
  email: string;
  role: string;
  permissions: Permission;
  accountStatus?: string;
  isOnline?: boolean;
  lastLogin?: string;
}

const SettingsManagement: React.FC = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [filter, setFilter] = useState<'all' | 'superadmin' | 'admin' | 'finance' | 'support'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getAllAdmins();
      setAdmins(response.admins || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch admins');
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  };

  const permissionLabels: (keyof Permission)[] = [
    'dashboard',
    'users',
    'jobs',
    'transactions',
    'verifications',
    'support',
    'activity',
    'flagged',
    'settings'
  ];

  const formatPermissionLabel = (key: string): string => {
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  const getAccessLevel = (role: string): { label: string; color: string } => {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'superadmin') {
      return { label: 'Super Admin', color: 'bg-green-100 text-green-800' };
    }
    if (normalizedRole === 'admin') {
      return { label: 'Admin', color: 'bg-blue-100 text-blue-800' };
    }
    if (normalizedRole === 'finance') {
      return { label: 'Finance', color: 'bg-yellow-100 text-yellow-800' };
    }
    if (normalizedRole === 'customer support' || normalizedRole === 'support') {
      return { label: 'Support', color: 'bg-purple-100 text-purple-800' };
    }
    return { label: 'Limited Access', color: 'bg-gray-100 text-gray-800' };
  };

  const getAccountStatus = (status?: string): { label: string; color: string } => {
    if (status === 'active') {
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    }
    if (status === 'suspended') {
      return { label: 'Suspended', color: 'bg-yellow-100 text-yellow-800' };
    }
    if (status === 'banned') {
      return { label: 'Banned', color: 'bg-red-100 text-red-800' };
    }
    if (status === 'restricted') {
      return { label: 'Restricted', color: 'bg-orange-100 text-orange-800' };
    }
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  };

  const formatLastLogin = (lastLogin?: string): string => {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getPermissionTemplate = (permissions: Permission): { name: string; color: string } => {
    if (Object.values(permissions).every(val => val === true)) {
      return { name: 'Full Access', color: 'bg-green-100 text-green-800' };
    }

    if (
      permissions.dashboard === true &&
      permissions.users === true &&
      permissions.jobs === true &&
      permissions.transactions === false &&
      permissions.verifications === true &&
      permissions.support === false &&
      permissions.activity === true &&
      permissions.flagged === true &&
      permissions.settings === false
    ) {
      return { name: 'Admin', color: 'bg-blue-100 text-blue-800' };
    }

    if (
      permissions.dashboard === true &&
      permissions.users === false &&
      permissions.jobs === false &&
      permissions.transactions === true &&
      permissions.verifications === false &&
      permissions.support === true &&
      permissions.activity === true &&
      permissions.flagged === false &&
      permissions.settings === false
    ) {
      return { name: 'Finance', color: 'bg-yellow-100 text-yellow-800' };
    }

    if (
      permissions.dashboard === true &&
      permissions.users === true &&
      permissions.jobs === true &&
      permissions.transactions === false &&
      permissions.verifications === true &&
      permissions.support === true &&
      permissions.activity === false &&
      permissions.flagged === true &&
      permissions.settings === false
    ) {
      return { name: 'Support', color: 'bg-purple-100 text-purple-800' };
    }

    return { name: 'Custom', color: 'bg-gray-100 text-gray-800' };
  };

  const handleEdit = (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedAdmin(null);
  };

  const getFilteredAdmins = () => {
    let filtered = admins;
    
    if (filter !== 'all') {
      filtered = filtered.filter(admin => {
        const role = admin.role.toLowerCase();
        if (filter === 'superadmin') return role === 'superadmin';
        if (filter === 'admin') return role === 'admin';
        if (filter === 'finance') return role === 'finance';
        if (filter === 'support') return role === 'customer support';
        return true;
      });
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(admin => 
        admin.fullName.toLowerCase().includes(search) ||
        admin.email.toLowerCase().includes(search) ||
        admin.uid.toLowerCase().includes(search) ||
        admin.role.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  };

  const filteredAdmins = getFilteredAdmins();
  const superAdminCount = admins.filter(a => a.role.toLowerCase() === 'superadmin').length;
  const adminCount = admins.filter(a => a.role.toLowerCase() === 'admin').length;
  const financeCount = admins.filter(a => a.role.toLowerCase() === 'finance').length;
  const supportCount = admins.filter(a => a.role.toLowerCase() === 'customer support').length;

  if (user?.role !== 'superadmin') {
    return (
      <div className="fixed inset-0 md:left-64 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to access this page.</p>
          <p className="text-sm text-gray-500 mt-2">Only super administrators can access settings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 md:left-64 flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading admins...</span>
      </div>
    );
  }

  return (
    <>
      <CreateAdminModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchAdmins}
      />
      
      <EditAdminModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={fetchAdmins}
        admin={selectedAdmin}
      />
      
      <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Admin Management</h1>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">
                    Manage admin accounts and configure system permissions
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
              >
                <UserPlus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Create new admin</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div
                onClick={() => setFilter('all')}
                className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                  filter === 'all' ? 'border-gray-500 ring-2 ring-gray-500 shadow-lg' : 'border-gray-200'
                }`}
              >
                <p className="text-xs text-gray-600 font-medium mb-1">All Management</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{admins.length}</p>
              </div>

              <div
                onClick={() => setFilter('superadmin')}
                className={`bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                  filter === 'superadmin' ? 'border-green-500 ring-2 ring-green-400 shadow-lg' : 'border-green-200'
                }`}
              >
                <p className="text-xs text-gray-600 font-medium mb-1">Super Admin</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{superAdminCount}</p>
              </div>

              <div
                onClick={() => setFilter('admin')}
                className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                  filter === 'admin' ? 'border-blue-500 ring-2 ring-blue-400 shadow-lg' : 'border-blue-200'
                }`}
              >
                <p className="text-xs text-gray-600 font-medium mb-1">Admin</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{adminCount}</p>
              </div>

              <div
                onClick={() => setFilter('finance')}
                className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                  filter === 'finance' ? 'border-yellow-500 ring-2 ring-yellow-400 shadow-lg' : 'border-yellow-200'
                }`}
              >
                <p className="text-xs text-gray-600 font-medium mb-1">Finance</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{financeCount}</p>
              </div>

              <div
                onClick={() => setFilter('support')}
                className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                  filter === 'support' ? 'border-purple-500 ring-2 ring-purple-400 shadow-lg' : 'border-purple-200'
                }`}
              >
                <p className="text-xs text-gray-600 font-medium mb-1">Support</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{supportCount}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by name, email, UID, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex-shrink-0 mx-4 md:mx-6 mt-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-3 md:px-4 py-3 rounded">
            <div className="flex items-center">
              <XCircle className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">Error: {error}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {filteredAdmins.length === 0 ? (
              <div className="h-full flex items-center justify-center bg-white p-12">
                <div className="text-center">
                  <ShieldAlert className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {searchTerm ? 'No matching admins found' : 
                     filter === 'all' ? 'No admin accounts found' : `No ${filter} admins`}
                  </h2>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try adjusting your search terms' :
                     admins.length === 0 ? 'Create a new admin account to get started.' : 'No admins found for this filter.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden md:block bg-white overflow-x-auto">
                <table className="min-w-full w-full table-auto">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        UID
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Full Name
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Email
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Role
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Permissions
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Last Login
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredAdmins.map((admin, index) => (
                      <React.Fragment key={admin._id}>
                        <tr 
                          onClick={() => handleEdit(admin)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {admin.uid}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {admin.fullName}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {admin.email}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                getAccountStatus(admin.accountStatus).color
                              }`}>
                                {getAccountStatus(admin.accountStatus).label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {admin.role}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex items-center justify-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                getPermissionTemplate(admin.permissions).color
                              }`}>
                                {getPermissionTemplate(admin.permissions).name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatLastLogin(admin.lastLogin)}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center text-blue-600 text-sm font-medium">
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </span>
                          </td>
                        </tr>
                        {index < filteredAdmins.length - 1 && (
                          <tr>
                            <td colSpan={8} className="p-0">
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
                {filteredAdmins.map((admin) => {
                  return (
                    <div 
                      key={admin._id} 
                      onClick={() => handleEdit(admin)}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-all"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900">{admin.fullName}</h3>
                            <p className="text-sm text-gray-600 truncate">{admin.email}</p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 flex-shrink-0 ml-2">
                            {admin.role}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-gray-500">{admin.uid}</p>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              getPermissionTemplate(admin.permissions).color
                            }`}>
                              {getPermissionTemplate(admin.permissions).name}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              getAccountStatus(admin.accountStatus).color
                            }`}>
                              {getAccountStatus(admin.accountStatus).label}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mb-3">
                          Last login: <span className="font-medium text-gray-700">{formatLastLogin(admin.lastLogin)}</span>
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 font-medium">Access Level:</span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              getAccessLevel(admin.role).color
                            }`}>
                              {getAccessLevel(admin.role).label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsManagement;
