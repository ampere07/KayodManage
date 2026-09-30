import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SidebarNav from './SidebarNav';
import type { NavGroupKey } from './navigationModel';

export const SidebarContext = React.createContext<{
  setSidebarOpen: (open: boolean) => void,
  setIsHeaderHidden?: (hidden: boolean) => void
}>({ setSidebarOpen: () => { } });

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const GROUP_PREFIXES: Record<NavGroupKey, string> = { jobs: '/jobs', users: '/users', transactions: '/transactions', settings: '/settings' };

const Layout: React.FC<LayoutProps> = ({ children, title }) => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<NavGroupKey, boolean>>({ jobs: false, users: false, transactions: false, settings: false });
  const location = useLocation();
  const { logout, user } = useAuth();

  React.useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const key of Object.keys(GROUP_PREFIXES) as NavGroupKey[]) {
        if (location.pathname.startsWith(GROUP_PREFIXES[key])) next[key] = true;
      }
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (key: NavGroupKey) => setOpenGroups((current) => ({ ...current, [key]: !current[key] }));

  const handleLogout = () => {
    logout();
  };


  return (
    <SidebarContext.Provider value={{ setSidebarOpen, setIsHeaderHidden }}>
      <div className={`bg-gray-50 ${title === 'Dashboard' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        {/* Mobile sidebar */}
        <div className={`fixed inset-0 flex z-50 md:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
          <div className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSidebarOpen(false)} />

          <div className={`relative flex-1 flex flex-col max-w-[280px] w-full bg-white transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div   className="flex-shrink-0 flex items-center px-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Admin Panel</span>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                <SidebarNav variant="mobile" user={user} openGroups={openGroups} onToggleGroup={toggleGroup} onNavigate={() => setSidebarOpen(false)} />
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
        <div className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0">
          <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Kayod</span>
              </div>
              <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
                <SidebarNav variant="desktop" user={user} openGroups={openGroups} onToggleGroup={toggleGroup} />
              </nav>
            </div>

            <div className="flex items-center border-t border-gray-200 px-4 h-[65px]">
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
        <div className={`md:pl-72 flex flex-col flex-1 ${title === 'Dashboard' ? 'h-full overflow-hidden' : ''}`}>
          {/* Mobile Header */}
          {!location.pathname.startsWith('/settings/configuration') && !isHeaderHidden && (
            <header className="sticky top-0 z-30 md:hidden bg-white border-b border-gray-100 h-16 flex items-center px-4 gap-3 shadow-sm">
              {/* Hamburger */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 flex flex-col items-center justify-center gap-[5px] active:scale-95 transition-all flex-shrink-0"
              >
                <span className="w-[18px] h-[2px] bg-gray-900 rounded-full" />
                <span className="w-[12px] h-[2px] bg-gray-400 rounded-full self-start ml-[11px]" />
                <span className="w-[18px] h-[2px] bg-gray-900 rounded-full" />
              </button>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <h1 className="text-[15px] font-black text-gray-900 leading-tight truncate">
                  {title === 'Dashboard' ? 'Dashboard Overview' : title}
                </h1>
                <p className="text-[10px] text-gray-400 font-medium truncate">
                  {(() => {
                    switch (title) {
                      case 'Dashboard': return "Welcome back! Your service marketplace's performance view";
                      case 'All Users': return 'Monitor and manage all user accounts across the platform';
                      case 'Customers': return 'Manage customer accounts and their service requests';
                      case 'Service Providers': return 'Manage service providers and their verification status';
                      case 'Flagged & Suspended': return 'Review and manage restricted, suspended, and banned user accounts';
                      case 'Deleted Users': return 'View and manage soft deleted user accounts';
                      case 'Jobs Management': return 'Monitor and manage all service requests across the platform';
                      case 'Archived Jobs': return 'View and manage job listings that have been hidden or removed';
                      case 'Fee Records':
                      case 'Top-up Transactions':
                      case 'Cashout Transactions':
                      case 'Refund Transactions': return 'Monitor financial records and payments';
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

            </header>
          )}

          <main className={`flex-1 ${title === 'Dashboard' ? 'overflow-hidden' : ''}`}>
            <div className={title === 'Dashboard' ? 'h-full' : 'py-2 sm:py-3 md:py-4'}>
              <div className={`max-w-full mx-auto ${title === 'Dashboard' ? 'h-full' : 'px-2 sm:px-4 md:px-6 lg:px-8'}`}>
                {/* Desktop Title (Hidden on Mobile since it's in the header) */}
                {title !== 'All Users' && title !== 'Customers' && title !== 'Service Providers' && title !== 'Flagged & Suspended' && title !== 'Deleted Users' && title !== 'Jobs' && title !== 'Archived Jobs' && title !== 'Dashboard' && title !== 'System Configuration' && title !== 'Fee Records' && title !== 'Top-up Transactions' && title !== 'Cashout Transactions' && title !== 'Refund Transactions' && (
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
