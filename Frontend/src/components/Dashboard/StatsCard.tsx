import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'purple' | 'red' | 'indigo';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    indigo: 'bg-indigo-100 text-indigo-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="flex items-center gap-2.5 sm:gap-4">
        <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs md:text-sm font-medium text-gray-500 sm:text-gray-600 truncate">
            {title}
          </p>
          <div className="flex items-baseline flex-wrap gap-x-1 sm:gap-x-2">
            <p className="text-base sm:text-xl md:text-2xl font-bold sm:font-semibold text-gray-900 truncate max-w-full" title={value}>
              {value}
            </p>
            {trend && (
              <p className={`text-[10px] sm:text-xs md:text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;