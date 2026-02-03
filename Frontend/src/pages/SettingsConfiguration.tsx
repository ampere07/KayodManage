import React, { useState, useContext } from 'react';
import { Briefcase, Megaphone, Menu } from 'lucide-react';
import JobCategoryConfiguration from '../components/Settings/JobCategoryConfiguration';
import { SidebarContext } from '../components/Layout/Layout';
import { useAuth } from '../context/AuthContext';

const SettingsConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'job-category' | 'advertisement'>('job-category');
  const { setSidebarOpen } = useContext(SidebarContext);
  const { user } = useAuth();

  const getDescription = () => {
    if (activeTab === 'job-category') {
      return 'Manage Job Category Icons, Names, and Professions';
    }
    return 'Configure advertisement placements, banners, and promotional content';
  };

  const sidebarItems = [
    { id: 'job-category' as const, label: 'Job Category', icon: Briefcase },
    { id: 'advertisement' as const, label: 'Advertisement', icon: Megaphone }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh)] md:h-[calc(100vh-2rem)] -mx-2 sm:-mx-4 md:-mx-6 lg:-mx-8 -my-2 sm:-my-3 md:-my-4 bg-gray-50">
      {/* Custom Header combining Page Header + Mobile sidebar toggle */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 sticky top-0 z-40">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              type="button"
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                {sidebarItems.find(item => item.id === activeTab)?.label}
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2">
                {getDescription()}
              </p>
            </div>
          </div>


        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden flex overflow-x-auto bg-white border-b border-gray-200 no-scrollbar">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === item.id
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex w-20 md:w-48 bg-white border-r border-gray-200 overflow-y-auto flex-col items-center md:items-stretch py-4 transition-[width] duration-300 ease-in-out">
          <nav className="space-y-2 md:space-y-1 w-full px-2 md:px-0">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  className={`w-full relative flex items-center justify-center md:justify-start md:gap-3 md:px-4 py-3 text-sm font-medium transition-all duration-200 group ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 md:bg-blue-50 md:text-blue-600 md:shadow-none'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900 md:text-gray-700'
                    } ${isActive ? 'rounded-xl md:rounded-none' : 'rounded-xl md:rounded-none'}`}
                >
                  {isActive && (
                    <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                  )}
                  <Icon className={`h-6 w-6 md:h-5 md:w-5 transition-transform duration-200 ${isActive ? 'scale-110 md:scale-100' : 'group-hover:scale-110 md:group-hover:scale-100'}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'job-category' && <JobCategoryConfiguration />}

          {activeTab === 'advertisement' && (
            <div className="p-6 bg-white">
              <p className="text-gray-500">Advertisement configuration coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsConfiguration;
