import React from 'react';
import { Briefcase } from 'lucide-react';

const JobCategoryConfiguration: React.FC = () => {
  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex items-center min-w-0">
          <Briefcase className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2 md:mr-3 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Job Category Configuration</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Manage job categories, subcategories, and related settings
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="text-center">
          <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-600">
            Job category configuration will be available here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default JobCategoryConfiguration;
