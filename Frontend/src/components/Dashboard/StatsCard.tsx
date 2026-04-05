import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowUp, ArrowDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'purple' | 'red' | 'indigo' | 'orange';
  variant?: 'solid' | 'default' | 'tinted';
  onClick?: () => void;
  isActive?: boolean;
  smallIcon?: boolean;
}

const MiniChart = ({ isPositive, isSolid }: { isPositive: boolean; isSolid: boolean }) => {
  const strokeColor = isSolid ? '#ffffff' : isPositive ? '#10b981' : '#ef4444';
  const pathData = isPositive
    ? "M0,20 C5,20 10,5 18,12 C25,18 30,8 35,15 C45,25 50,5 60,10 C70,15 75,25 85,10 C90,2 95,15 100,5"
    : "M0,5 C5,5 10,20 18,12 C25,8 30,18 35,15 C45,5 50,25 60,18 C70,12 75,5 85,20 C90,28 95,15 100,25";

  return (
    <div className="relative w-full h-full">
      {isSolid && (
        <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M0,20 L100,20" stroke="#ffffff" strokeWidth="2" strokeDasharray="2 4" />
        </svg>
      )}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path 
          d={pathData} 
          fill="none" 
          stroke={strokeColor} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
    </div>
  );
};

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, color, variant = 'default', onClick, isActive, smallIcon }) => {
  const isSolid = variant === 'solid';
  const isTinted = variant === 'tinted';

  const defaultIconColors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    purple: 'bg-purple-100 text-purple-700',
    red: 'bg-red-100 text-red-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    orange: 'bg-orange-100 text-orange-700'
  };

  const tintedBorderClasses = {
    blue: isActive ? "border-blue-500" : "border-blue-200",
    green: isActive ? "border-emerald-500" : "border-emerald-200",
    purple: isActive ? "border-purple-500" : "border-purple-200",
    red: isActive ? "border-red-500" : "border-red-200",
    indigo: isActive ? "border-indigo-500" : "border-indigo-200",
    orange: isActive ? "border-orange-500" : "border-orange-200"
  };

  const tintedContainerClasses = {
    blue: `bg-blue-50/80 ${tintedBorderClasses.blue} text-blue-900 border`,
    green: `bg-emerald-50/80 ${tintedBorderClasses.green} text-emerald-900 border`,
    purple: `bg-purple-50/80 ${tintedBorderClasses.purple} text-purple-900 border`,
    red: `bg-red-50/80 ${tintedBorderClasses.red} text-red-900 border`,
    indigo: `bg-indigo-50/80 ${tintedBorderClasses.indigo} text-indigo-900 border`,
    orange: `bg-orange-50/80 ${tintedBorderClasses.orange} text-orange-900 border`
  };

  let containerClasses = `bg-white text-gray-900 border ${isActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 shadow-sm'}`;
  if (isSolid) {
    containerClasses = `bg-[#18a05e] text-white shadow-md shadow-emerald-500/20 ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18a05e]' : ''}`;
  } else if (isTinted) {
    containerClasses = `transition-all duration-200 ${tintedContainerClasses[color]} ${isActive ? 'shadow-md scale-[1.02] ring-1 ring-opacity-50' : ''}`;
    // Add specific ring color for tinted cards when active
    if (isActive) {
      const ringColors = {
        blue: 'ring-blue-500',
        green: 'ring-emerald-500',
        purple: 'ring-purple-500',
        red: 'ring-red-500',
        indigo: 'ring-indigo-500',
        orange: 'ring-orange-500'
      };
      containerClasses += ` ${ringColors[color]} font-semibold`;
    }
  }

  const iconCircleClasses = isSolid
    ? "bg-white text-[#18a05e]"
    : isTinted 
      ? `bg-white shadow-sm ${defaultIconColors[color].split(' ')[1]}`
      : defaultIconColors[color];

  const titleClasses = isSolid
    ? "text-white font-medium"
    : isTinted
      ? "text-gray-900 font-semibold"
      : "text-gray-800 font-semibold";

  const trendColorClass = isSolid
    ? "text-emerald-50"
    : trend?.isPositive ? "text-emerald-500" : "text-red-500";

  return (
    <div 
      onClick={onClick}
      className={`rounded-2xl flex flex-col ${trend ? 'justify-center sm:justify-between' : 'justify-center'} overflow-hidden ${trend ? 'p-3 sm:p-5 h-[96px] sm:h-[160px]' : 'p-3 sm:p-4 h-[88px] sm:h-[102px]'} ${containerClasses} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Mobile Layout - Widget Style */}
      <div className="flex sm:hidden flex-col h-full w-full relative">
        <div className="flex justify-between items-start w-full absolute top-0 left-0 right-0">
          <div className={`w-[30px] h-[30px] rounded-[10px] flex items-center justify-center flex-shrink-0 ${iconCircleClasses}`}>
            <Icon className="w-[18px] h-[18px]" />
          </div>
          {trend && (
            <span className={`text-[11px] font-bold whitespace-nowrap mt-1 ${trendColorClass}`}>
              {trend.isPositive ? '+' : ''}{trend.value}{!isSolid && trend.value !== 0 ? '%' : ''}
            </span>
          )}
        </div>
        
        <div className="flex flex-col items-start justify-center flex-1 w-full min-w-0 mt-5 pt-2">
          <span className="text-[20px] font-black tracking-tight truncate max-w-full leading-none" title={value}>{value}</span>
          <span className={`text-[10px] font-semibold opacity-85 uppercase tracking-wide truncate max-w-full mt-1.5 ${titleClasses}`}>{title}</span>
        </div>
      </div>

      {/* Desktop Layout - Orginal Full Size */}
      <div className="hidden sm:flex justify-between items-start w-full">
        <div className="flex items-center gap-3">
          <div className={`${smallIcon ? 'w-8 h-8 rounded-lg' : 'w-11 h-11 rounded-full'} flex items-center justify-center flex-shrink-0 ${iconCircleClasses}`}>
            <Icon className={smallIcon ? 'w-5 h-5' : 'w-6 h-6'} />
          </div>
          <span className={`text-[15px] max-w-full ${titleClasses}`}>
            {title}
          </span>
        </div>
        
        {isActive && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSolid ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}>
            <ArrowUpRight className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className={`hidden sm:flex justify-between items-end ${trend ? 'mt-auto pt-2' : 'mt-2 pt-1'} gap-2 relative w-full`}>
        <div className="flex flex-col gap-1.5 min-w-0 z-10 w-auto">
          <span className="text-3xl font-bold tracking-tight truncate max-w-full" title={value}>
            {value}
          </span>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${trendColorClass}`}>
              {trend.isPositive ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />}
              <span className="truncate flex items-center">
                {Math.abs(trend.value)}% <span className={isSolid ? "text-emerald-100/80 font-medium inline ml-1" : "text-gray-500 font-medium inline ml-1"}>this week</span>
              </span>
            </div>
          )}
        </div>
        
        {trend && (
          <div className="static w-24 h-10 flex-shrink-0 mb-1 opacity-100 z-0 pointer-events-none">
            <MiniChart isPositive={trend.isPositive} isSolid={isSolid} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;