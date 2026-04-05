import { Clock, CheckCircle, XCircle } from 'lucide-react';

/**
 * Support utility helper functions
 */

/**
 * Get priority badge component
 */
export const getPriorityBadge = (priority: string): JSX.Element => {
  const configs = {
    urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
    low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' }
  };

  const config = configs[priority as keyof typeof configs] || configs.low;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

/**
 * Get status badge component
 */
export const getStatusBadge = (
  status: string,
  acceptedBy?: string,
  displayStatus?: string
): JSX.Element => {
  // Use displayStatus if provided (from backend)
  const effectiveStatus = displayStatus || (status === 'open' && !acceptedBy ? 'open' : status === 'open' && acceptedBy ? 'pending' : 'resolved');

  if (effectiveStatus === 'open') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 shadow-sm shadow-blue-100/50">
        <Clock className="w-3 h-3 mr-1" />
        Open
      </span>
    );
  }
  else if (effectiveStatus === 'pending') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm shadow-yellow-100/50">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    );
  }
  else if (effectiveStatus === 'resolved' || status === 'closed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-800 border border-green-200 shadow-sm shadow-green-100/50">
        <CheckCircle className="w-3 h-3 mr-1" />
        Resolved
      </span>
    );
  }
  // Fallback
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-800">
      <XCircle className="w-3 h-3 mr-1" />
      {effectiveStatus.toUpperCase()}
    </span>
  );
};

/**
 * Support categories list
 */
export const SUPPORT_CATEGORIES = [
  'Technical Issue',
  'Billing',
  'Account',
  'Feature Request',
  'General Inquiry',
  'Bug Report',
  'Other'
] as const;

export type SupportCategory = typeof SUPPORT_CATEGORIES[number];

/**
 * Support priorities list
 */
export const SUPPORT_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export type SupportPriorityType = typeof SUPPORT_PRIORITIES[number];
