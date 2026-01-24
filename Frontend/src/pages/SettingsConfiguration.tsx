import React, { useState } from 'react';
import { Briefcase, Megaphone } from 'lucide-react';
import JobCategoryConfiguration from '../components/Settings/JobCategoryConfiguration';

const SettingsConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'job-category' | 'advertisement'>('job-category');

  const getDescription = () => {
    if (activeTab === 'job-category') {
      return 'Manage job categories, subcategories, and service types available on the platform';
    }
    return 'Configure advertisement placements, banners, and promotional content';
  };

  const sidebarItems = [
    { id: 'job-category' as const, label: 'Job Category', icon: Briefcase },
    { id: 'advertisement' as const, label: 'Advertisement', icon: Megaphone }
  ];

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Configurations</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">
          {getDescription()}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <nav className="py-4">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                  )}
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
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
