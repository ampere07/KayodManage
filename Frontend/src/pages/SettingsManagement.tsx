import React, { useState } from 'react';
import {
  UserPlus,
  ShieldAlert,
  Edit2,
  Search,
  Briefcase,
  Shield,
  Users,
  CreditCard,
  MessageSquare,
  Lock,
  ShieldCheck,
  Activity,
  UserCheck,
  Filter as FilterIcon,
  UserCog,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services';
import CreateAdminModal from '../components/Settings/CreateAdminModal';
import EditAdminModal from '../components/Settings/EditAdminModal';
import StatsCard from '../components/Dashboard/StatsCard';
import { getInitials } from '../utils';

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
  profileImage?: string;
}

const SettingsManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: admins = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await settingsService.getAllAdmins();
      return response.admins || [];
    },
  });
  const error = queryError ? (queryError as any)?.message || 'Failed to fetch admins' : null;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [filter, setFilter] = useState<'all' | 'superadmin' | 'admin' | 'finance' | 'support'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAdmins = () => {
    queryClient.invalidateQueries({ queryKey: ['admins'] });
  };

  const getAccessLevel = (role: string): { label: string; color: string } => {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'superadmin') {
      return { label: 'Super Admin', color: 'bg-green-50 text-green-700 border-green-100' };
    }
    if (normalizedRole === 'admin') {
      return { label: 'Admin', color: 'bg-blue-50 text-blue-700 border-blue-100' };
    }
    if (normalizedRole === 'finance') {
      return { label: 'Finance', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' };
    }
    if (normalizedRole === 'customer support' || normalizedRole === 'support') {
      return { label: 'Support', color: 'bg-purple-50 text-purple-700 border-purple-100' };
    }
    return { label: 'Limited Access', color: 'bg-gray-50 text-gray-700 border-gray-100' };
  };

  const getAccountStatus = (status?: string): { label: string; color: string; icon: React.ReactNode } => {
    if (status === 'active') {
      return { label: 'Active', color: 'bg-green-50 text-green-700 border-green-100', icon: <UserCheck className="w-3 h-3" /> };
    }
    if (status === 'suspended') {
      return { label: 'Suspended', color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: <Activity className="w-3 h-3" /> };
    }
    if (status === 'banned') {
      return { label: 'Banned', color: 'bg-red-50 text-red-700 border-red-100', icon: <Lock className="w-3 h-3" /> };
    }
    if (status === 'restricted') {
      return { label: 'Restricted', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: <ShieldAlert className="w-3 h-3" /> };
    }
    return { label: 'Unknown', color: 'bg-gray-50 text-gray-700 border-gray-100', icon: <Shield className="w-3 h-3" /> };
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
      return { name: 'Full Access', color: 'bg-green-50 text-green-700 border-green-100' };
    }

    // Support Template
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
      return { name: 'Support', color: 'bg-purple-50 text-purple-700 border-purple-100' };
    }

    // Admin Template
    if (
      permissions.dashboard === true &&
      permissions.users === true &&
      permissions.jobs === true &&
      permissions.transactions === true &&
      permissions.verifications === true &&
      permissions.support === true &&
      permissions.activity === true &&
      permissions.flagged === true &&
      permissions.settings === false
    ) {
      return { name: 'Admin', color: 'bg-blue-50 text-blue-700 border-blue-100' };
    }

    // Finance Template
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
      return { name: 'Finance', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' };
    }

    return { name: 'Customized', color: 'bg-slate-50 text-slate-700 border-slate-100' };
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
        if (filter === 'support') return role === 'customer support' || role === 'support';
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
  const supportCount = admins.filter(a => a.role.toLowerCase() === 'customer support' || a.role.toLowerCase() === 'support').length;

  if (user?.role !== 'superadmin') {
    return (
      <div className="fixed inset-0 md:left-72 flex items-center justify-center bg-gray-50 mt-16 md:mt-0">
        <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-red-50 flex items-center justify-center border-4 border-white shadow-xl">
              <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg border border-red-100">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight uppercase italic">Access Denied</h2>
            <p className="text-sm text-gray-500 font-medium">
              You do not have the required permissions to access administrative settings.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 py-2 px-4 bg-red-50 rounded-full border border-red-100 shadow-sm shadow-red-500/10">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Super Admin Eyes Only</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 md:left-72 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-blue-600 animate-spin" />
            <UserCog className="absolute inset-0 m-auto h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          <div className="flex flex-col items-center italic">
            <p className="text-sm font-black text-gray-900 tracking-widest uppercase">Loading Admin Directory</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Verifying System Access</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden text-gray-700">
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

      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 pb-2 md:px-6 md:py-5">
          <div className="hidden md:flex items-center justify-between mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight truncate">
                  Admin Authority
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Manage system administrators, configure granular permissions and monitor account activity
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="group flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-900/10 active:scale-95 flex-shrink-0"
            >
              <UserPlus className="h-4 w-4 group-hover:rotate-12 transition-transform" />
              <span className="text-xs font-black uppercase tracking-widest">New Admin</span>
            </button>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden">
            {/* Summary strip + New Admin button */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Admins</p>
                <p className="text-base font-black text-blue-600 leading-tight">{admins.length.toLocaleString()}</p>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Super Admin</p>
                <p className="text-base font-black text-green-600 leading-tight">{superAdminCount.toLocaleString()}</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-xl active:scale-95 transition-all flex-shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">New</span>
              </button>
            </div>
            {/* Filter pills — 5 items → grid-cols-3 = 2 rows */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { label: 'All',     value: admins.length,    filterVal: 'all',        activeBg: 'bg-blue-500',    border: 'border-blue-500'    },
                { label: 'Super',   value: superAdminCount,  filterVal: 'superadmin', activeBg: 'bg-green-500',   border: 'border-green-500'   },
                { label: 'Admin',   value: adminCount,       filterVal: 'admin',      activeBg: 'bg-indigo-500',  border: 'border-indigo-500'  },
                { label: 'Finance', value: financeCount,     filterVal: 'finance',    activeBg: 'bg-orange-500',  border: 'border-orange-500'  },
                { label: 'Support', value: supportCount,     filterVal: 'support',    activeBg: 'bg-purple-500',  border: 'border-purple-500'  },
              ] as { label: string; value: number; filterVal: string; activeBg: string; border: string }[]).map(({ label, value, filterVal, activeBg, border }) => {
                const active = filter === filterVal;
                return (
                  <button
                    key={filterVal}
                    onClick={() => setFilter(filterVal as typeof filter)}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-full border transition-all active:scale-95 ${active ? `${activeBg} ${border} text-white` : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                    <span className="text-[11px] font-black">{value.toLocaleString()}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'text-white/80' : 'text-gray-400'}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="cursor-pointer" onClick={() => setFilter('all')}>
              <StatsCard
                title="All Management"
                value={admins.length.toString()}
                icon={Briefcase}
                color="blue"
                variant="tinted"
                isActive={filter === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setFilter('superadmin')}>
              <StatsCard
                title="Super Admin"
                value={superAdminCount.toString()}
                icon={Shield}
                color="green"
                variant="tinted"
                isActive={filter === 'superadmin'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setFilter('admin')}>
              <StatsCard
                title="Admin"
                value={adminCount.toString()}
                icon={Users}
                color="indigo"
                variant="tinted"
                isActive={filter === 'admin'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setFilter('finance')}>
              <StatsCard
                title="Finance"
                value={financeCount.toString()}
                icon={CreditCard}
                color="orange"
                variant="tinted"
                isActive={filter === 'finance'}
                smallIcon={true}
              />
            </div>
            <div className="hidden lg:block cursor-pointer" onClick={() => setFilter('support')}>
              <StatsCard
                title="Support"
                value={supportCount.toString()}
                icon={MessageSquare}
                color="purple"
                variant="tinted"
                isActive={filter === 'support'}
                smallIcon={true}
              />
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center gap-3 md:gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 md:h-4 md:w-4" />
            <input
              type="text"
              placeholder="Search by name, email, UID, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 h-8 md:h-auto md:py-2 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs md:text-sm font-medium transition-all shadow-sm"
            />
          </div>

          <div className="hidden md:flex items-center gap-1.5 p-1 bg-white border border-gray-100 rounded-xl shadow-sm">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}>All</button>
            <button onClick={() => setFilter('superadmin')} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filter === 'superadmin' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Super</button>
            <button onClick={() => setFilter('admin')} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filter === 'admin' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Admin</button>
            <button onClick={() => setFilter('finance')} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filter === 'finance' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Finance</button>
            <button onClick={() => setFilter('support')} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filter === 'support' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>Support</button>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-white px-3 py-2 border border-gray-100 rounded-xl shadow-sm">
            <FilterIcon className="h-4 w-4 text-gray-400" />
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Displaying {filteredAdmins.length} Results</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-tight">Access Error: {error}</span>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {filteredAdmins.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <ShieldAlert className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium italic uppercase tracking-widest text-sm">No administrators found</p>
              <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-tighter">Adjust your filters or verify directory sync</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white flex-1 relative overflow-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Identity
                      </th>
                      <th className="w-[15%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Authority
                      </th>
                      <th className="w-[15%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[15%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Permissions
                      </th>
                      <th className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Last Activity
                      </th>
                      <th className="w-[5%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {filteredAdmins.map((admin) => (
                      <tr
                        key={admin._id}
                        onClick={() => handleEdit(admin)}
                        className="group h-20 transition-all duration-150 cursor-pointer"
                      >
                        <td className="w-[30%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              {admin.profileImage ? (
                                <img
                                  src={admin.profileImage}
                                  alt={admin.fullName}
                                  className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm transition-transform group-hover:scale-110">
                                  <span className="text-sm font-black text-indigo-600">
                                    {getInitials(admin.fullName)}
                                  </span>
                                </div>
                              )}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${admin.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-gray-600 truncate leading-tight">{admin.fullName}</div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <span>{admin.email}</span>
                                <span className="text-gray-300">•</span>
                                <span className="font-mono text-gray-400">ID: {admin.uid}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="w-[15%] px-6 py-2 border-b border-gray-300 h-20 align-middle text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getAccessLevel(admin.role).color}`}>
                            {getAccessLevel(admin.role).label}
                          </span>
                        </td>
                        <td className="w-[15%] px-6 py-2 border-b border-gray-300 h-20 align-middle text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm ${getAccountStatus(admin.accountStatus).color}`}>
                            {getAccountStatus(admin.accountStatus).icon}
                            {getAccountStatus(admin.accountStatus).label}
                          </span>
                        </td>
                        <td className="w-[15%] px-6 py-2 border-b border-gray-300 h-20 align-middle text-center">
                          <div className="flex items-center justify-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getPermissionTemplate(admin.permissions).color}`}>
                              {getPermissionTemplate(admin.permissions).name}
                            </span>
                          </div>
                        </td>
                        <td className="w-[20%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                          <div className="text-xs font-black text-gray-600">{formatLastLogin(admin.lastLogin)}</div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 italic">Session Activity</div>
                        </td>
                        <td className="w-[5%] px-6 py-2 border-b border-gray-300 h-20 align-middle text-center">
                          <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                <Edit2 className="h-4 w-4" />
                             </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden px-3 py-3 space-y-2">
                {filteredAdmins.map((admin) => (
                  <div
                    key={admin._id}
                    onClick={() => handleEdit(admin)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                  >
                    {/* Main Row */}
                    <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
                      <div className="relative flex-shrink-0">
                        {admin.profileImage ? (
                          <img src={admin.profileImage} alt={admin.fullName} className="h-12 w-12 rounded-full object-cover border border-gray-100" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                            <span className="text-sm font-black text-indigo-600">{getInitials(admin.fullName)}</span>
                          </div>
                        )}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${admin.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${getAccessLevel(admin.role).color}`}>
                            {getAccessLevel(admin.role).label}
                          </span>
                        </div>
                        <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{admin.fullName}</p>
                      </div>
                      {/* Status + permission stacked on right */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getAccountStatus(admin.accountStatus).color}`}>
                          {getAccountStatus(admin.accountStatus).icon}
                          {getAccountStatus(admin.accountStatus).label}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${getPermissionTemplate(admin.permissions).color}`}>
                          {getPermissionTemplate(admin.permissions).name}
                        </span>
                      </div>
                    </div>
                    {/* Footer strip */}
                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-500 truncate flex-1 min-w-0">{admin.email}</p>
                      <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {formatLastLogin(admin.lastLogin)}
                      </div>
                      <span className="text-[9px] font-mono font-bold text-gray-400 flex-shrink-0">#{admin.uid.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsManagement;
