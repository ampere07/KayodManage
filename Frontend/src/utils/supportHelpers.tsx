import React from 'react';
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
 * Get status badge component based on status and assignment
 */
export const getStatusBadge = (
  status: string,
  assignedTo?: string,
  acceptedBy?: string
): JSX.Element => {
  // Open = no admin has accepted (unassigned)
  if (status === 'open' && !assignedTo && !acceptedBy) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        <Clock className="w-3 h-3 mr-1" />
        Open
      </span>
    );
  }
  // Pending = accepted by an admin (assigned but not closed)
  else if (status === 'open' && (assignedTo || acceptedBy)) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    );
  }
  // Resolved = closed by admin
  else if (status === 'closed') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3 mr-1" />
        Resolved
      </span>
    );
  }
  // Fallback
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      <XCircle className="w-3 h-3 mr-1" />
      {status}
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
