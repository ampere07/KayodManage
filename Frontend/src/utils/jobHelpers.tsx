import React from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

/**
 * Job utility helper functions
 */

/**
 * Get initials from a name
 */
export const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

/**
 * Get job status color classes for badges
 */
export const getJobStatusColor = (status: string): string => {
  switch (status) {
    case 'open':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'in_progress':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'completed':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

/**
 * Get job status icon component
 */
export const getJobStatusIcon = (status: string): JSX.Element => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4" />;
    case 'in_progress':
      return <Clock className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

/**
 * Job categories list
 */
export const JOB_CATEGORIES = [
  'carpentry',
  'plumbing',
  'electrical',
  'cleaning',
  'gardening',
  'painting',
  'appliance repair',
  'moving',
  'tutoring',
  'beauty'
] as const;

export type JobCategory = typeof JOB_CATEGORIES[number];
