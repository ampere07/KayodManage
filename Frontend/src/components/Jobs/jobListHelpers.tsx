import { format } from 'date-fns';
import { AlertTriangle, MessageSquareQuote, CalendarClock, ShieldCheck, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getProfessionIconByName } from '../../constants/categoryIcons';
import type { Job, JobStatus } from '../../types/jobs.types';

/** One look per status: the pipeline bar, the tab dot and the row badge agree. */
export const JOB_STATUSES: { key: JobStatus; label: string; color: string; badge: string; dot: string }[] = [
  { key: 'open', label: 'Open', color: '#3b82f6', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { key: 'scheduled', label: 'Scheduled', color: '#8b5cf6', badge: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  { key: 'in_progress', label: 'In progress', color: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', color: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  { key: 'expired', label: 'Expired', color: '#9ca3af', badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
];
export const statusMeta = (status: string) =>
  JOB_STATUSES.find((s) => s.key === status) || { key: status as JobStatus, label: status.replace('_', ' '), color: '#9ca3af', badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };

/** Budget, or for a quote-priced job (budget 0) the agreed quote. */
export const jobPrice = (job: Job) => (job.budget > 0 ? job.budget : (job.agreedPrice || job.acceptedProvider?.agreedPrice || 0));

export const peso = (amount: number) => `₱${Math.round(amount || 0).toLocaleString('en-PH')}`;

const day = (value?: Date | string | null) => (value ? format(new Date(value), 'MMM d') : '');

export interface StatusDetail {
  text: string;
  icon: LucideIcon;
  tone: 'muted' | 'warn' | 'alert';
}

/**
 * The one line under a row's status that says what that status means for this
 * job right now: how many quotes, when it's booked, whether money is held, or
 * that a dispute is open (which outranks everything else).
 */
export const statusDetail = (job: Job): StatusDetail => {
  if (job.completionStatus?.dispute?.isActive) return { text: 'Dispute open', icon: AlertTriangle, tone: 'alert' };
  switch (job.status) {
    case 'open': {
      const quotes = job.applicationCount || 0;
      return quotes
        ? { text: `${quotes} ${quotes === 1 ? 'quote' : 'quotes'}`, icon: MessageSquareQuote, tone: 'muted' }
        : { text: 'No quotes yet', icon: MessageSquareQuote, tone: 'warn' };
    }
    case 'scheduled':
      return { text: job.date ? `Booked for ${day(job.date)}` : 'Booked', icon: CalendarClock, tone: 'muted' };
    case 'in_progress':
      return job.paymentStatus === 'escrow_held'
        ? { text: `${peso(job.escrowAmount || jobPrice(job))} held`, icon: ShieldCheck, tone: 'muted' }
        : { text: 'Under way', icon: Hourglass, tone: 'muted' };
    case 'completed':
      return { text: job.completionStatus?.completedAt ? `Done ${day(job.completionStatus.completedAt)}` : 'Done', icon: CheckCircle2, tone: 'muted' };
    case 'cancelled':
      return { text: job.cancellation?.cancelledAt ? `Cancelled ${day(job.cancellation.cancelledAt)}` : 'Cancelled', icon: XCircle, tone: 'muted' };
    default:
      return { text: 'Not booked in time', icon: Hourglass, tone: 'muted' };
  }
};

export const DETAIL_TONE: Record<StatusDetail['tone'], string> = {
  muted: 'text-gray-500',
  warn: 'text-amber-600',
  alert: 'text-red-600 font-semibold',
};

/** A label that is an ObjectId (old data) reads as a generic service. */
export const serviceLabel = (job: Job, fallback = '') => {
  const label = job.professionName || job.categoryName || job.category || fallback;
  return /^[a-fA-F0-9]{24}$/.test(label) ? 'General Service' : label || 'General Service';
};

const LEGACY_ICONS: Record<string, string> = {
  catering: 'custom:catering.webp',
  painting: 'custom:painter.webp',
  beauty: 'custom:beauty--personal-care.webp',
  cleaning: 'custom:house-cleaning.webp',
  carpentry: 'custom:carpentry-cabinetry.webp',
  acrefrigeration: 'custom:ac--refrigerator.webp',
  acref: 'custom:ac--refrigerator.webp',
  gardening: 'custom:gardening--landscaping.webp',
  landscaping: 'custom:gardening--landscaping.webp',
  moving: 'custom:lipat-bahay-mover.webp',
  delivery: 'custom:delivery.webp',
  courier: 'custom:delivery.webp',
  computerrepair: 'custom:computer-technician.webp',
  itrep: 'custom:computer-technician.webp',
  automechanic: 'custom:auto-mechanic.webp',
  automecanic: 'custom:auto-mechanic.webp',
  creativedesign: 'custom:graphic-design.webp',
  graphicdesign: 'custom:graphic-design.webp',
  logo: 'custom:graphic-design.webp',
  housekeeping: 'custom:house-cleaning.webp',
  handyman: 'custom:general-handyman.webp',
  maintenance: 'custom:general-handyman.webp',
  welding: 'custom:welding.webp',
  architecture: 'custom:architecture-drafting.webp',
  architectural: 'custom:architecture-drafting.webp',
  architecturedrafting: 'custom:architecture-drafting.webp',
};

/**
 * A job's icon: its profession's icon from the categories, else the job's own
 * icon value, else its category's icon, else a known legacy name. (Moved
 * unchanged from the Jobs page.)
 */
export const resolveJobIcon = (categories: any[], jobCategory: string, jobIcon?: string): { imagePath: string; label: string } => {
  if (!jobCategory) return { imagePath: '/assets/icons/categories/professional-services.png', label: 'General Service' };
  const normalized = jobCategory.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = (name: string) => {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n === normalized || n.includes(normalized) || normalized.includes(n);
  };

  for (const c of categories) {
    const prof = c.professions?.find((p: any) => matches(p.name));
    if (prof && prof.icon) return getProfessionIconByName(prof.icon, c.icon);
  }
  if (jobIcon && jobIcon.startsWith('ik:')) return getProfessionIconByName(jobIcon);
  if (jobIcon && (jobIcon.startsWith('http') || jobIcon.includes('.'))) {
    const file = jobIcon.startsWith('custom:') ? jobIcon.replace('custom:', '') : jobIcon;
    return { imagePath: jobIcon.startsWith('http') ? jobIcon : `/assets/icons/professions/${file}`, label: jobCategory };
  }

  let categoryIcon = '';
  let icon = '';
  const cat = categories.find((c: any) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);
  if (cat) {
    categoryIcon = cat.icon || '';
  } else {
    for (const c of categories) {
      const prof = c.professions?.find((p: any) => matches(p.name));
      if (prof) { icon = prof.icon || ''; categoryIcon = c.icon || ''; break; }
    }
  }
  if (!icon) icon = LEGACY_ICONS[normalized] || '';
  return getProfessionIconByName(icon, categoryIcon);
};

export const FALLBACK_ICON = '/assets/icons/categories/professional-services.png';
