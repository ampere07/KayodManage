import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  Settings,
  AlertTriangle,
  Activity,
  MessageCircleQuestion,
  Shield,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  // Force rebuild
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isJobsOpen, setIsJobsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
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

  const hasPermission = (permission: string) => {
    if (user?.role === 'superadmin') return true;
    if (!user?.permissions) return true;
    return user.permissions[permission as keyof typeof user.permissions] || false;
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' }
  ];

  const userItems = [
    { to: '/users', label: 'All Users' },
    { to: '/users/customers', label: 'Customers' },
    { to: '/users/providers', label: 'Service Providers' },
    { to: '/users/flagged', label: 'Flagged & Suspended' }
  ];

  const jobItems = [
    { to: '/jobs', label: 'All Jobs' },
    { to: '/jobs/archived', label: 'Archived' }
  ];

  const transactionItems = [
    { to: '/transactions/fee-records', label: 'Fee Records' },
    { to: '/transactions/top-up', label: 'Top-up' },
    { to: '/transactions/cashout', label: 'Cashout' },
    { to: '/transactions/refund', label: 'Refund' }
  ];

  const settingsItems = [
    { to: '/settings/management', label: 'Management' },
    { to: '/settings/configuration', label: 'Configuration' }
  ];

  const bottomNavItems = [
    { to: '/verifications', icon: Shield, label: 'Verifications', permission: 'verifications' },
    { to: '/support', icon: MessageCircleQuestion, label: 'Support', permission: 'support' },
    { to: '/activity', icon: Activity, label: 'Activity', permission: 'activity' },
    { to: '/flagged', icon: AlertTriangle, label: 'Flagged', permission: 'flagged' }
  ];

  const isTransactionPage = location.pathname.startsWith('/transactions');
  const isUserPage = location.pathname.startsWith('/users');
  const isJobPage = location.pathname.startsWith('/jobs');
  const isSettingsPage = location.pathname.startsWith('/settings');

  const handleTransactionClick = () => {
    setIsTransactionsOpen(prev => !prev);
  };

  const handleUsersClick = () => {
    setIsUsersOpen(prev => !prev);
  };

  const handleJobsClick = () => {
    setIsJobsOpen(prev => !prev);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(prev => !prev);
  };

  const handleNavClick = (e: React.MouseEvent, hasPermission: boolean) => {
    if (!hasPermission) {
      e.preventDefault();
    }
  };

  return (
    <div className="bg-gray-900 text-white w-72 min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">Admin Panel v2</h1>
        <p className="text-gray-400 text-sm mt-1">Service Platform</p>
      </div>

      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        <ul className="space-y-2 pb-4">
          {navItems.map((item) => {
            const allowed = hasPermission(item.permission);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={(e) => handleNavClick(e, allowed)}
                  className={({ isActive }) => {
                    if (!allowed) {
                      return 'flex items-center space-x-3 px-4 py-3 rounded-lg opacity-40 cursor-not-allowed text-gray-500';
                    }
                    return `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`;
                  }}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={handleJobsClick}
              disabled={!hasPermission('jobs')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${!hasPermission('jobs')
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : isJobPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <div className="flex items-center space-x-3">
                <Briefcase size={20} />
                <span>Jobs</span>
              </div>
              {isJobsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {isJobsOpen && (
              <ul className="mt-2 space-y-1 bg-gray-800 rounded-lg p-2">
                {jobItems.map((item) => {
                  const allowed = hasPermission('jobs');
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/jobs'}
                        onClick={(e) => handleNavClick(e, allowed)}
                        className={({ isActive }) => {
                          if (!allowed) {
                            return 'block px-4 py-2 rounded-lg text-sm opacity-40 cursor-not-allowed text-gray-500';
                          }
                          return `block px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${isActive
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`;
                        }}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          <li>
            <button
              type="button"
              onClick={handleUsersClick}
              disabled={!hasPermission('users')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${!hasPermission('users')
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : isUserPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <div className="flex items-center space-x-3">
                <Users size={20} />
                <span>Users</span>
              </div>
              {isUsersOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {isUsersOpen && (
              <ul className="mt-2 space-y-1 bg-gray-800 rounded-lg p-2">
                {userItems.map((item) => {
                  const allowed = hasPermission('users');
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/users'}
                        onClick={(e) => handleNavClick(e, allowed)}
                        className={({ isActive }) => {
                          if (!allowed) {
                            return 'block px-4 py-2 rounded-lg text-sm opacity-40 cursor-not-allowed text-gray-500';
                          }
                          return `block px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${isActive
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`;
                        }}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          <li>
            <button
              type="button"
              onClick={handleTransactionClick}
              disabled={!hasPermission('transactions')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${!hasPermission('transactions')
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : isTransactionPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <div className="flex items-center space-x-3">
                <CreditCard size={20} />
                <span>Transactions</span>
              </div>
              {isTransactionsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {isTransactionsOpen && (
              <ul className="mt-2 space-y-1 bg-gray-800 rounded-lg p-2">
                {transactionItems.map((item) => {
                  const allowed = hasPermission('transactions');
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={(e) => handleNavClick(e, allowed)}
                        className={({ isActive }) => {
                          if (!allowed) {
                            return 'block px-4 py-2 rounded-lg text-sm opacity-40 cursor-not-allowed text-gray-500';
                          }
                          return `block px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${isActive
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`;
                        }}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          <li className="pt-4 mt-4 border-t border-gray-700">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-4">Management</div>
          </li>

          {bottomNavItems.map((item) => {
            const allowed = hasPermission(item.permission);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={(e) => handleNavClick(e, allowed)}
                  className={({ isActive }) => {
                    if (!allowed) {
                      return 'flex items-center space-x-3 px-4 py-3 rounded-lg opacity-40 cursor-not-allowed text-gray-500';
                    }
                    return `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`;
                  }}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={handleSettingsClick}
              disabled={!hasPermission('settings')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${!hasPermission('settings')
                  ? 'opacity-40 cursor-not-allowed text-gray-500'
                  : isSettingsPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <div className="flex items-center space-x-3">
                <Settings size={20} />
                <span>Settings</span>
              </div>
              {isSettingsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {isSettingsOpen && (
              <ul className="mt-2 space-y-1 bg-gray-800 rounded-lg p-2">
                {settingsItems.map((item) => {
                  const allowed = hasPermission('settings');
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={(e) => handleNavClick(e, allowed)}
                        className={({ isActive }) => {
                          if (!allowed) {
                            return 'block px-4 py-2 rounded-lg text-sm opacity-40 cursor-not-allowed text-gray-500';
                          }
                          return `block px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${isActive
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`;
                        }}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-400">System Online</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
