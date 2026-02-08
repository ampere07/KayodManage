import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  Activity,
  AlertTriangle,
  Settings,
  Menu,
  LogOut,
  Shield,
  MessageSquare,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SidebarContext = React.createContext<{
  setSidebarOpen: (open: boolean) => void,
  setIsHeaderHidden?: (hidden: boolean) => void
}>({ setSidebarOpen: () => { } });

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isJobsOpen, setIsJobsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();

  const hasPermission = (permission: string) => {
    if (user?.role === 'superadmin') return true;
    if (!user?.permissions) return true;
    return user.permissions[permission as keyof typeof user.permissions] || false;
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'dashboard' }
  ];

  const userItems = [
    { name: 'All Users', href: '/users' },
    { name: 'Customers', href: '/users/customers' },
    { name: 'Service Providers', href: '/users/providers' },
    { name: 'Flagged & Suspended', href: '/users/flagged' }
  ];

  const jobItems = [
    { name: 'All Jobs', href: '/jobs' },
    { name: 'Archived', href: '/jobs/archived' }
  ];

  const transactionItems = [
    { name: 'Fee Records', href: '/transactions/fee-records' },
    { name: 'Top-up', href: '/transactions/top-up' },
    { name: 'Cashout', href: '/transactions/cashout' },
    { name: 'Refund', href: '/transactions/refund' }
  ];

  const settingsItems = [
    { name: 'Management', href: '/settings/management' },
    { name: 'Configuration', href: '/settings/configuration' }
  ];

  const bottomNavigation = [
    { name: 'Verifications', href: '/verifications', icon: Shield, permission: 'verifications' },
    { name: 'Support', href: '/support', icon: MessageSquare, permission: 'support' },
    { name: 'Activity', href: '/activity', icon: Activity, permission: 'activity' },
    { name: 'Flagged', href: '/flagged', icon: AlertTriangle, permission: 'flagged' }
  ];

  React.useEffect(() => {
    if (location.pathname.startsWith('/transactions')) {
      setIsTransactionsOpen(true);
    }
    if (location.pathname.startsWith('/users')) {
      setIsUsersOpen(true);
    }
    if (location.pathname.startsWith('/jobs')) {
      setIsJobsOpen(true);
    }
    if (location.pathname.startsWith('/settings')) {
      setIsSettingsOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
  };

  const isTransactionPage = location.pathname.startsWith('/transactions');
  const isUserPage = location.pathname.startsWith('/users');
  const isJobPage = location.pathname.startsWith('/jobs');
  const isSettingsPage = location.pathname.startsWith('/settings');

  return (
    <SidebarContext.Provider value={{ setSidebarOpen, setIsHeaderHidden }}>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar */}
        <div className={`fixed inset-0 flex z-50 md:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
          <div className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSidebarOpen(false)} />

          <div className={`relative flex-1 flex flex-col max-w-[280px] w-full bg-white transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Admin Panel</span>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const allowed = hasPermission(item.permission);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={(e) => {
                        if (!allowed) {
                          e.preventDefault();
                        } else {
                          setSidebarOpen(false);
                        }
                      }}
                      className={`group flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors ${!allowed
                        ? 'opacity-40 cursor-not-allowed text-gray-400'
                        : isActive
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <item.icon className={`mr-4 h-6 w-6 ${!allowed ? 'text-gray-300' : isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      {item.name}
                    </Link>
                  );
                })}



                <div>
                  <button
                    type="button"
                    onClick={() => hasPermission('jobs') && setIsJobsOpen(!isJobsOpen)}
                    disabled={!hasPermission('jobs')}
                    className={`w-full group flex items-center justify-between px-3 py-3 text-base font-medium rounded-md transition-colors ${!hasPermission('jobs')
                      ? 'opacity-40 cursor-not-allowed text-gray-400'
                      : isJobPage
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Briefcase className={`mr-4 h-6 w-6 ${!hasPermission('jobs') ? 'text-gray-300' : isJobPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Jobs</span>
                    </div>
                    {isJobsOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>

                  {isJobsOpen && hasPermission('jobs') && (
                    <div className="ml-11 mt-1 space-y-1">
                      {jobItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => hasPermission('users') && setIsUsersOpen(!isUsersOpen)}
                    disabled={!hasPermission('users')}
                    className={`w-full group flex items-center justify-between px-3 py-3 text-base font-medium rounded-md transition-colors ${!hasPermission('users')
                      ? 'opacity-40 cursor-not-allowed text-gray-400'
                      : isUserPage
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Users className={`mr-4 h-6 w-6 ${!hasPermission('users') ? 'text-gray-300' : isUserPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Users</span>
                    </div>
                    {isUsersOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>

                  {isUsersOpen && hasPermission('users') && (
                    <div className="ml-11 mt-1 space-y-1">
                      {userItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => hasPermission('transactions') && setIsTransactionsOpen(!isTransactionsOpen)}
                    disabled={!hasPermission('transactions')}
                    className={`w-full group flex items-center justify-between px-3 py-3 text-base font-medium rounded-md transition-colors ${!hasPermission('transactions')
                      ? 'opacity-40 cursor-not-allowed text-gray-400'
                      : isTransactionPage
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <CreditCard className={`mr-4 h-6 w-6 ${!hasPermission('transactions') ? 'text-gray-300' : isTransactionPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Transactions</span>
                    </div>
                    {isTransactionsOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>

                  {isTransactionsOpen && hasPermission('transactions') && (
                    <div className="ml-11 mt-1 space-y-1">
                      {transactionItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {bottomNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const allowed = hasPermission(item.permission);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={(e) => {
                        if (!allowed) {
                          e.preventDefault();
                        } else {
                          setSidebarOpen(false);
                        }
                      }}
                      className={`group flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors ${!allowed
                        ? 'opacity-40 cursor-not-allowed text-gray-400'
                        : isActive
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <item.icon className={`mr-4 h-6 w-6 ${!allowed ? 'text-gray-300' : isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      {item.name}
                    </Link>
                  );
                })}

                <div>
                  <button
                    type="button"
                    onClick={() => hasPermission('settings') && setIsSettingsOpen(!isSettingsOpen)}
                    disabled={!hasPermission('settings')}
                    className={`w-full group flex items-center justify-between px-3 py-3 text-base font-medium rounded-md transition-colors ${!hasPermission('settings')
                      ? 'opacity-40 cursor-not-allowed text-gray-400'
                      : isSettingsPage
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Settings className={`mr-4 h-6 w-6 ${!hasPermission('settings') ? 'text-gray-300' : isSettingsPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Settings</span>
                    </div>
                    {isSettingsOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>

                  {isSettingsOpen && hasPermission('settings') && (
                    <div className="ml-11 mt-1 space-y-1">
                      {settingsItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            <div className="flex border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">{user?.username}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Static sidebar for desktop */}
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
          <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Kayod</span>
              </div>
              <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      {item.name}
                    </Link>
                  );
                })}

                <div>
                  <button
                    type="button"
                    onClick={() => setIsJobsOpen(!isJobsOpen)}
                    className={`w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${isJobPage
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Briefcase className={`mr-3 h-5 w-5 ${isJobPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Jobs</span>
                    </div>
                    {isJobsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {isJobsOpen && (
                    <div className="ml-10 mt-1 space-y-1">
                      {jobItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setIsUsersOpen(!isUsersOpen)}
                    className={`w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${isUserPage
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Users className={`mr-3 h-5 w-5 ${isUserPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Users</span>
                    </div>
                    {isUsersOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {isUsersOpen && (
                    <div className="ml-10 mt-1 space-y-1">
                      {userItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
                    className={`w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${isTransactionPage
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <CreditCard className={`mr-3 h-5 w-5 ${isTransactionPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Transactions</span>
                    </div>
                    {isTransactionsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {isTransactionsOpen && (
                    <div className="ml-10 mt-1 space-y-1">
                      {transactionItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {bottomNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const allowed = hasPermission(item.permission);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={(e) => {
                        if (!allowed) {
                          e.preventDefault();
                        }
                      }}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${!allowed
                        ? 'opacity-40 cursor-not-allowed text-gray-400'
                        : isActive
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <item.icon className={`mr-3 h-5 w-5 ${!allowed ? 'text-gray-300' : isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      {item.name}
                    </Link>
                  );
                })}

                <div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${isSettingsPage
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Settings className={`mr-3 h-5 w-5 ${isSettingsPage ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>Settings</span>
                    </div>
                    {isSettingsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {isSettingsOpen && (
                    <div className="ml-10 mt-1 space-y-1">
                      {settingsItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            <div className="flex border-t border-gray-200 p-4">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user?.username}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        {/* Main content */}
        <div className="md:pl-64 flex flex-col flex-1">
          {/* Mobile Header */}
          {!location.pathname.startsWith('/settings/configuration') && !isHeaderHidden && (
            <header className="sticky top-0 z-30 md:hidden bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {(() => {
                      switch (title) {
                        case 'Dashboard': return 'Overview of system performance and activities';
                        case 'All Users':
                        case 'Customers':
                        case 'Service Providers':
                        case 'Flagged & Suspended':
                          return 'Manage customer and service provider accounts';
                        case 'Jobs':
                        case 'Archived Jobs':
                          return 'View and manage service job requests';
                        case 'Fee Records':
                        case 'Top-up Transactions':
                        case 'Cashout Transactions':
                        case 'Refund Transactions':
                          return 'Monitor financial records and payments';
                        case 'User Verifications': return 'Review identity verification requests';
                        case 'Activity Feed': return 'System-wide audit logs and user actions';
                        case 'Flagged': return 'Review flagged content and users';
                        case 'Support Center': return 'Manage support tickets and inquiries';
                        case 'Admin Management': return 'Manage admin accounts and permissions';
                        case 'System Configuration': return 'Manage system-wide settings and variables';
                        default: return 'Manage platform resources';
                      }
                    })()}
                  </p>
                </div>
              </div>

            </header>
          )}

          <main className="flex-1">
            <div className="py-2 sm:py-3 md:py-4">
              <div className="max-w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
                {/* Desktop Title (Hidden on Mobile since it's in the header) */}
                {title !== 'All Users' && title !== 'Customers' && title !== 'Service Providers' && title !== 'Flagged & Suspended' && title !== 'Jobs' && title !== 'Archived Jobs' && title !== 'Dashboard' && title !== 'System Configuration' && title !== 'Fee Records' && title !== 'Top-up Transactions' && title !== 'Cashout Transactions' && title !== 'Refund Transactions' && (
                  <div className="hidden md:block mb-8">
                    <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                  </div>
                )}
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Layout;
