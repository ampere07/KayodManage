import React from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

const Alerts: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All Clear!</h2>
          <p className="text-gray-600">
            No critical alerts at this time. The system is running smoothly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Alerts;