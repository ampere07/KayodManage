import React, { useState, useEffect } from 'react';
import { UserPlus, ShieldAlert, Edit2, Settings as SettingsIcon, XCircle, Search } from 'lucide-react';
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
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [filter, setFilter] = useState<'all' | 'admin' | 'finance' | 'support'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

  const handleEdit = (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedAdmin(null);
  };

  const toggleCardExpansion = (adminId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(adminId)) {
        newSet.delete(adminId);
      } else {
        newSet.add(adminId);
      }
      return newSet;
    });
  };

  const getFilteredAdmins = () => {
    let filtered = admins;
    
    if (filter !== 'all') {
      filtered = filtered.filter(admin => {
        const role = admin.role.toLowerCase();
        if (filter === 'admin') return role === 'admin' || role === 'superadmin';
        if (filter === 'finance') return role === 'finance';
        if (filter === 'support') return role === 'support';
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
  const adminCount = admins.filter(a => {
    const role = a.role.toLowerCase();
    return role === 'admin' || role === 'superadmin';
  }).length;
  const financeCount = admins.filter(a => a.role.toLowerCase() === 'finance').length;
  const supportCount = admins.filter(a => a.role.toLowerCase() === 'support').length;

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
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0">
                <SettingsIcon className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2 md:mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Settings</h1>
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

            {/* Search and Filter Controls */}
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

              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                {[
                  { key: 'all', label: 'All', count: admins.length },
                  { key: 'admin', label: 'Admin', count: adminCount },
                  { key: 'finance', label: 'Finance', count: financeCount },
                  { key: 'support', label: 'Support', count: supportCount }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as 'all' | 'admin' | 'finance' | 'support')}
                    className={`px-3 py-1.5 text-xs md:text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
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
        </div>

        {/* Error State */}
        {error && (
          <div className="flex-shrink-0 mx-4 md:mx-6 mt-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-3 md:px-4 py-3 rounded">
            <div className="flex items-center">
              <XCircle className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">Error: {error}</span>
            </div>
          </div>
        )}

        {/* Scrollable Table Container */}
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
                {/* Desktop Table View */}
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
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Role
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Permissions
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredAdmins.map((admin, index) => (
                      <React.Fragment key={admin._id}>
                        <tr className="hover:bg-gray-50 transition-colors">
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {admin.role}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex items-center justify-center space-x-2 lg:space-x-3">
                              {permissionLabels.map((permission) => (
                                <div key={permission} className="flex flex-col items-center">
                                  <label className="text-xs text-gray-600 mb-1 whitespace-nowrap">
                                    {formatPermissionLabel(permission)}
                                  </label>
                                  <input
                                    type="checkbox"
                                    checked={admin.permissions[permission]}
                                    disabled
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-not-allowed opacity-60"
                                  />
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleEdit(admin)}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </button>
                          </td>
                        </tr>
                        {index < filteredAdmins.length - 1 && (
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

              {/* Mobile Card View */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {filteredAdmins.map((admin) => {
                  const isExpanded = expandedCards.has(admin._id);
                  const activePermissions = permissionLabels.filter(p => admin.permissions[p]);
                  
                  return (
                    <div key={admin._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      {/* Card Header - Always Visible */}
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
                        
                        <p className="text-xs text-gray-500 mb-3">{admin.uid}</p>

                        {/* Quick Permissions Summary */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleCardExpansion(admin._id)}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            <span className="font-medium">
                              {isExpanded ? 'Hide' : 'Show'} Permissions
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                              {activePermissions.length}/{permissionLabels.length}
                            </span>
                            <svg
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleEdit(admin)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Expandable Permissions Section */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Permissions</p>
                          <div className="grid grid-cols-2 gap-3">
                            {permissionLabels.map((permission) => (
                              <div
                                key={permission}
                                className={`flex items-center gap-2 p-2 rounded ${
                                  admin.permissions[permission]
                                    ? 'bg-blue-50'
                                    : 'bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={admin.permissions[permission]}
                                  disabled
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-not-allowed"
                                />
                                <span className={`text-sm ${
                                  admin.permissions[permission]
                                    ? 'text-gray-900 font-medium'
                                    : 'text-gray-500'
                                }`}>
                                  {formatPermissionLabel(permission)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

export default Settings;
