// Updated: 2024-12-21
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

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/transactions')) {
      setIsTransactionsOpen(true);
    }
    if (location.pathname.startsWith('/users')) {
      setIsUsersOpen(true);
    }
  }, [location.pathname]);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  ];

  console.log('Sidebar v2 loaded - Users dropdown enabled');

  const userItems = [
    { to: '/users', label: 'All Users' },
    { to: '/users/customers', label: 'Customers' },
    { to: '/users/providers', label: 'Service Providers' },
    { to: '/users/flagged', label: 'Flagged & Suspended' }
  ];

  const transactionItems = [
    { to: '/transactions/fee-records', label: 'Fee Records' },
    { to: '/transactions/top-up', label: 'Top-up' },
    { to: '/transactions/cashout', label: 'Cashout' },
    { to: '/transactions/refund', label: 'Refund' }
  ];

  const bottomNavItems = [
    { to: '/verifications', icon: Shield, label: 'Verifications' },
    { to: '/support', icon: MessageCircleQuestion, label: 'Support' },
    { to: '/activity', icon: Activity, label: 'Activity' },
    { to: '/alerts', icon: AlertTriangle, label: 'Alerts' },
    { to: '/settings', icon: Settings, label: 'Settings' }
  ];

  const isTransactionPage = location.pathname.startsWith('/transactions');
  const isUserPage = location.pathname.startsWith('/users');

  const handleTransactionClick = () => {
    setIsTransactionsOpen(prev => !prev);
  };

  const handleUsersClick = () => {
    console.log('Users dropdown clicked');
    setIsUsersOpen(prev => !prev);
  };

  return (
    <div className="bg-gray-900 text-white w-64 min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">Admin Panel v2</h1>
        <p className="text-gray-400 text-sm mt-1">Service Platform</p>
      </div>
      
      <nav className="flex-1 px-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
          
          <li>
            <button
              type="button"
              onClick={handleUsersClick}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${
                isUserPage
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
                {userItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/users'}
                      className={({ isActive }) =>
                        `block px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
          
          <li>
            <button
              type="button"
              onClick={handleTransactionClick}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${
                isTransactionPage
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
                {transactionItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `block px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
          
          {bottomNavItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
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
