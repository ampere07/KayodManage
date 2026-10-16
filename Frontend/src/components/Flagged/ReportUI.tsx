import React from 'react';
import { Ban, Clock, ShieldAlert, Trash2 } from 'lucide-react';
import { reportStatusLabel } from '../../types/flagged.types';

/**
 * The small visual pieces the Flagged table and the review panel share, in the
 * same language as the Users page: initials avatars, dotted status pills, and
 * flags as a coloured icon + word instead of stacked chips.
 */

export const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  open: { pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  under_review: { pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  action_taken: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  dismissed: { pill: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  escalated: { pill: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
};

export const StatusPill: React.FC<{ status: string; className?: string; testId?: string }> = ({ status, className = '', testId }) => {
  const style = STATUS_STYLE[status] || STATUS_STYLE.open;
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${style.pill} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {reportStatusLabel(status)}
    </span>
  );
};

export const initialsOf = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const AVATAR_TONE = {
  // The person reported reads warm, the reporter neutral blue (as on the Users page).
  reported: 'bg-rose-50 text-rose-600 ring-rose-100',
  reporter: 'bg-blue-50 text-blue-600 ring-blue-100',
} as const;

const AVATAR_SIZE = {
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
} as const;

export const PartyAvatar: React.FC<{ name?: string | null; tone: keyof typeof AVATAR_TONE; size?: keyof typeof AVATAR_SIZE }> = ({ name, tone, size = 'sm' }) => (
  <span className={`${AVATAR_SIZE[size]} ${AVATAR_TONE[tone]} rounded-full ring-1 flex items-center justify-center font-bold shrink-0 select-none`}>
    {initialsOf(name)}
  </span>
);

const SIGNAL_TONE = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  orange: 'text-orange-600',
  violet: 'text-violet-600',
  slate: 'text-slate-500',
  gray: 'text-gray-500',
} as const;
export type SignalTone = keyof typeof SIGNAL_TONE;

/** One flag on a row: a coloured icon and a short word. */
export const Signal: React.FC<{ icon: React.ElementType; tone: SignalTone; title?: string; children: React.ReactNode; testId?: string }> = ({ icon: Icon, tone, title, children, testId }) => (
  <span title={title} data-testid={testId} className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${SIGNAL_TONE[tone]}`}>
    <Icon className="h-3 w-3 shrink-0" />
    {children}
  </span>
);

/** How a non-active account shows up as a signal. */
export const ACCOUNT_SIGNAL: Record<string, { icon: React.ElementType; tone: SignalTone; label: string }> = {
  restricted: { icon: ShieldAlert, tone: 'amber', label: 'Restricted' },
  suspended: { icon: Clock, tone: 'orange', label: 'Suspended' },
  banned: { icon: Ban, tone: 'red', label: 'Banned' },
  deleted: { icon: Trash2, tone: 'gray', label: 'Deleted' },
};
