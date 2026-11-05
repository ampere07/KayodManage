import React from 'react';
import type { Job } from '../../types/jobs.types';
import { DETAIL_TONE, FALLBACK_ICON, jobPrice, peso, statusDetail, statusMeta } from './jobListHelpers';
import { ago } from '../UI/ListControls';

export { ago };

// The row pieces the Jobs and Archived Jobs lists share, so their rows look
// and behave the same. The list controls (sort headers, footer) are in
// UI/ListControls, shared with the Users page too.

export const JobIcon: React.FC<{ src: string; className: string }> = ({ src, className }) => (
  <img
    src={src}
    alt=""
    className={className}
    onError={(e) => {
      e.currentTarget.onerror = null;
      e.currentTarget.src = FALLBACK_ICON;
    }}
  />
);

export const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
  const meta = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase whitespace-nowrap ${small ? 'px-2 py-0.5 text-[9px] tracking-tight' : 'px-2.5 py-1 text-[10px] tracking-wider'} ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

export const StatusLine: React.FC<{ job: Job; className?: string }> = ({ job, className = '' }) => {
  const detail = statusDetail(job);
  const Icon = detail.icon;
  return (
    <span className={`flex items-center gap-1 min-w-0 ${DETAIL_TONE[detail.tone]} ${className}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{detail.text}</span>
    </span>
  );
};

/**
 * One side of the job, labelled with its role: the client who posted it, or
 * the provider booked on it. Role colours are the Users page's account types.
 */
export const Person: React.FC<{ name?: string; role: 'Client' | 'Provider'; empty?: string; small?: boolean }> = ({ name, role, empty, small }) => (
  <div className="flex items-baseline gap-2 min-w-0" data-role={role.toLowerCase()} title={name ? `${role}: ${name}` : undefined}>
    <span className={`flex-shrink-0 font-black uppercase tracking-wider ${small ? 'w-[50px] text-[8px]' : 'w-[60px] text-[9px]'} ${role === 'Client' ? 'text-purple-600' : 'text-indigo-600'}`}>
      {role}
    </span>
    <span className={`truncate ${small ? 'text-[11px]' : 'text-xs'} ${name ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{name || empty}</span>
  </div>
);

export const providerEmpty = (job: Job) => (job.status === 'open' ? 'No provider yet' : job.acceptedProvider ? 'Provider booked' : 'No provider');

export const PriceText: React.FC<{ job: Job; className: string }> = ({ job, className }) => {
  const price = jobPrice(job);
  return price > 0
    ? <span className={`font-black text-gray-900 tabular-nums ${className}`}>{peso(price)}</span>
    : <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{job.status === 'open' ? 'By quote' : '—'}</span>;
};
