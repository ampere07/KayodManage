import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  XCircle,
  MapPin,
  Users,
  Briefcase,
  Clock,
  Copy,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import VerificationStatusBadge from '../UI/VerificationStatusBadge';
import ClickableImage from '../UI/ClickableImage';
import PanelSection from '../UI/PanelSection';
import { useJobCategories } from '../../hooks/useJobs';
import { resolveJobIcon } from '../Jobs/jobListHelpers';
import { JobIcon, StatusBadge, StatusLine } from '../Jobs/JobListParts';
import { jobsService } from '../../services';
import type { Job, JobQuote, JobQuoteStatus } from '../../types/jobs.types';
import { SidebarContext } from '../Layout/Layout';
import { formatReleaseWindow, getServiceClass } from '../../constants/serviceClasses';
import { getProfessionDisplayName } from '../../utils/professionUtils';

// ImageKit configuration
const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/9vpn8u272';

/**
 * Convert media URL to ImageKit URL if it has ik: prefix
 * This ensures job attachments are fetched from ImageKit's imageUpload folder
 */
const getImageKitMediaUrl = (url: string): string => {
  if (!url) return '';
  
  // If already a full ImageKit URL, return as-is
  if (url.startsWith(IMAGEKIT_URL_ENDPOINT)) {
    return url;
  }
  
  // If has ik: prefix, convert to full ImageKit URL
  if (url.startsWith('ik:')) {
    const path = url.replace('ik:', '');
    return `${IMAGEKIT_URL_ENDPOINT}${path}`;
  }
  
  // Return original URL (Cloudinary or other)
  return url;
};

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
}

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const QUOTE_STATUS_STYLE: Record<JobQuoteStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  accepted: 'bg-green-50 text-green-700 border-green-100',
  rejected: 'bg-red-50 text-red-700 border-red-100',
  withdrawn: 'bg-gray-50 text-gray-600 border-gray-200',
  expired: 'bg-gray-50 text-gray-600 border-gray-200',
};

/** A person on the job, labelled with their role (the Jobs list's colours). */
const PartyCard: React.FC<{ role: 'Client' | 'Provider'; name?: string; image?: string; verified?: boolean; lines: string[]; id?: string }> = ({ role, name, image, verified, lines, id }) => (
  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 min-w-0" data-testid={`job-party-${role.toLowerCase()}`}>
    {image ? (
      <img src={image} alt="" className="h-10 w-10 rounded-full object-cover border border-gray-100 flex-shrink-0" />
    ) : (
      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${role === 'Provider' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
        <span className="text-sm font-bold">{getInitials(name || '?')}</span>
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className={`text-[9px] font-black uppercase tracking-wider ${role === 'Provider' ? 'text-indigo-600' : 'text-purple-600'}`}>{role}</p>
      <div className="flex items-center gap-1.5 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{name || 'Unknown'}</p>
        {verified && <VerificationStatusBadge isVerified={true} size="sm" />}
      </div>
      {lines.length > 0 && <p className="text-[11px] text-gray-500 truncate">{lines.join(' · ')}</p>}
    </div>
    {id && <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">KYD {id.slice(-8).toUpperCase()}</span>}
  </div>
);

/** A labelled fact tile (the user and transaction panels' look). */
const Fact: React.FC<{ label: string; value: string; sub?: string; subTone?: string }> = ({ label, value, sub, subTone = 'text-gray-500' }) => (
  <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
    <p className="mt-0.5 text-sm font-black text-gray-900 truncate">{value}</p>
    {sub && <p className={`text-[11px] truncate ${subTone}`}>{sub}</p>}
  </div>
);

/** Destructive actions that route through the shared confirmation sheet. */
type ConfirmKind = 'hide' | 'delete' | 'restore' | 'cancel';

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  isOpen,
  onClose,
  job
}) => {
  const queryClient = useQueryClient();
  const { categories } = useJobCategories();
  const [showQuotes, setShowQuotes] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [quotes, setQuotes] = useState<JobQuote[]>([]);
  // The full record from GET /jobs/:id (it arrives with the quotes): the
  // client's area and the provider's contact details the list row lacks.
  const [details, setDetails] = useState<Job | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  // One confirmation sheet drives every destructive action here. The native
  // confirm()/prompt() they used before gave no room to state consequences,
  // and delete could not explain itself at all.
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const { setIsHeaderHidden } = React.useContext(SidebarContext);

  useEffect(() => {
    if (setIsHeaderHidden) {
      setIsHeaderHidden(isOpen);
    }
    return () => {
      if (setIsHeaderHidden) {
        setIsHeaderHidden(false);
      }
    };
  }, [isOpen, setIsHeaderHidden]);

  // The job's quotes — its applicants in the app. Read-only: a client accepts a
  // quote in the app, which holds their payment in escrow; the admin panel does
  // not do that on their behalf.
  const jobId = job?._id;
  useEffect(() => {
    if (!isOpen || !jobId) return;
    let current = true;
    setQuotes([]);
    setDetails(null);
    setShowQuotes(false);
    setShowFullDescription(false);
    setShowAllMedia(false);
    setLoadingQuotes(true);
    jobsService.getJobById(jobId)
      .then((data) => {
        if (!current) return;
        setQuotes(data.quotes || []);
        setDetails(data as unknown as Job);
      })
      .catch((error) => console.error('Failed to fetch quotes:', error))
      .finally(() => { if (current) setLoadingQuotes(false); });
    return () => { current = false; };
  }, [isOpen, jobId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  // What the job is worth. Quote-based jobs keep budget 0 and carry the price
  // in the accepted quote — the same rule the Jobs list's Price column uses, so
  // the panel never says "Unset" for a job the list prices at ₱4,000.
  const jobPrice = !job
    ? 0
    : job.budget > 0
      ? job.budget
      : job.agreedPrice || job.acceptedProvider?.agreedPrice || 0;
  const priceIsQuote = !!job && !(job.budget > 0) && jobPrice > 0;

  const closeConfirm = () => {
    if (confirming) return;
    setConfirmKind(null);
    setConfirmReason("");
  };

  const handleUnhideJob = async () => {
    if (!job) return;
    try {
      await jobsService.unhideJob(job._id);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job unhidden');
      onClose();
    } catch (error) {
      console.error('Failed to unhide job:', error);
      toast.error('Failed to unhide job');
    }
  };

  /**
   * What each destructive action does and how it has to be confirmed. Keeping
   * them in one table means the sheet below is written once, and a new action
   * is a config entry rather than another copy of the markup.
   */
  const confirmConfig = !job || !confirmKind
    ? null
    : ({
        hide: {
          title: 'Hide this job?',
          confirmLabel: 'Hide job',
          busyLabel: 'Hiding…',
          reasonRequired: false,
          tone: 'amber' as const,
          consequences: [
            'The job stops appearing in search and browse for everyone.',
            'The client keeps it in their account, and you can unhide it later.',
          ],
          run: async () => {
            await jobsService.hideJob(job._id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('Job hidden');
          },
          errorMessage: 'Failed to hide job',
        },
        delete: {
          title: 'Delete this job?',
          confirmLabel: 'Delete job',
          busyLabel: 'Deleting…',
          reasonRequired: false,
          tone: 'red' as const,
          consequences: [
            'The job is archived and removed from the client’s account.',
            'Any applicants lose access to it.',
            'It can be restored from Archived Jobs.',
          ],
          run: async () => {
            await jobsService.deleteJob(job._id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
            toast.success('Job deleted successfully');
          },
          errorMessage: 'Failed to delete job',
        },
        restore: {
          title: 'Restore this job?',
          confirmLabel: 'Restore job',
          busyLabel: 'Restoring…',
          reasonRequired: false,
          tone: 'amber' as const,
          consequences: ['The job becomes visible to the client again.'],
          run: async () => {
            await jobsService.restoreJob(job._id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
            toast.success('Job restored successfully');
          },
          errorMessage: 'Failed to restore job',
        },
        cancel: {
          title: 'Cancel this job?',
          confirmLabel: 'Cancel job & refund',
          busyLabel: 'Cancelling…',
          // The only one that moves money, so the only one that demands a
          // written reason for the audit log.
          reasonRequired: true,
          tone: 'red' as const,
          consequences: [
            `Any payment still held is refunded to the client in full${
              jobPrice ? ` (up to ${formatCurrency(jobPrice)})` : ''
            }.`,
            'An active dispute is closed as “client refunded”.',
            'Both parties are notified. This cannot be undone.',
          ],
          run: async (reason: string) => {
            const result = await jobsService.forceCancelJob(job._id, reason);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCounts'] });
            // The refund lands on the client's wallet and money history.
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success(
              result.refundedAmount > 0
                ? `Job cancelled — ₱${result.refundedAmount} refunded to client`
                : 'Job cancelled successfully'
            );
          },
          errorMessage: 'Failed to cancel job',
        },
      }[confirmKind]);

  const runConfirmedAction = async () => {
    if (!confirmConfig || confirming) return;
    const reason = confirmReason.trim();
    if (confirmConfig.reasonRequired && !reason) return;

    setConfirming(true);
    try {
      await confirmConfig.run(reason);
      onClose();
    } catch (error: any) {
      console.error(confirmConfig.errorMessage, error);
      toast.error(error?.response?.data?.error || confirmConfig.errorMessage);
    } finally {
      setConfirming(false);
      setConfirmKind(null);
      setConfirmReason("");
    }
  };

  // Escape closes the confirmation sheet first, then the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || confirming) return;
      if (confirmKind) {
        setConfirmKind(null);
        setConfirmReason("");
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, confirmKind, confirming, onClose]);

  if (!isOpen || !job) return null;

  // The full record when it has arrived (contacts, the client's area), else the row.
  const full: Job = details || job;
  const client = full.user || job.user;
  const provider = full.assignedTo || job.assignedTo;
  const loc: any = full.location ?? job.location;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Job ID copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy Job ID');
    });
  };

  const iconSrc = (() => {
    const icon = resolveJobIcon(categories, job.professionName || job.categoryName || job.category || '', job.icon);
    return job.icon?.startsWith('ik:') && job.updatedAt ? `${icon.imagePath}?v=${new Date(job.updatedAt).getTime()}` : icon.imagePath;
  })();
  const service = (() => {
    const val = ((job as any).professionName || (job as any).categoryName || job.category || '').trim();
    if (!val || /^[a-fA-F0-9]{24}$/.test(val)) return 'General Service';
    // camelCase keys split, acronyms kept ("CCTV Installer", not "C C T V").
    return getProfessionDisplayName(val);
  })();

  // WHO: the quotes, summarised before they are listed.
  const quoteCount = loadingQuotes ? job.applicationCount || 0 : quotes.length;
  const amounts = quotes.map((q) => q.amount).filter((a): a is number => typeof a === 'number' && a > 0);
  const lowest = amounts.length ? Math.min(...amounts) : 0;
  const waitingQuotes = quotes.filter((q) => q.status === 'pending').length;

  // WHAT: money.
  const paymentLine = (() => {
    switch (job.paymentStatus) {
      case 'escrow_held': return { text: `${formatCurrency(job.escrowAmount || jobPrice)} held in escrow`, tone: 'text-blue-700' };
      case 'paid': return { text: `Paid${job.paidAmount ? ` · ${formatCurrency(job.paidAmount)}` : ''}`, tone: 'text-emerald-700' };
      case 'refunded': return { text: 'Refunded to the client', tone: 'text-gray-600' };
      case 'escrow_required': return { text: 'Waiting for the client to pay', tone: 'text-amber-700' };
      case 'failed': return { text: 'Payment failed', tone: 'text-red-700' };
      default: return { text: 'Not paid yet', tone: 'text-gray-500' };
    }
  })();
  const terms = getServiceClass(job.serviceClass);
  const media = job.media || [];

  // WHEN: everything that happened (or will), in order.
  const now = Date.now();
  const at = (value?: Date | string | null) => (value ? new Date(value) : null);
  const events = ([
    { key: 'posted', label: `Posted by ${client?.name || 'the client'}`, at: at(job.createdAt) },
    {
      key: 'wanted',
      label: 'Wanted for',
      at: at(job.date),
      detail: [
        (job.timeWindows || []).filter(Boolean).join(', '),
        (job.selectedDates || []).length > 1 ? `also ${(job.selectedDates || []).slice(1).map((d) => format(new Date(d), 'MMM d')).join(', ')}` : '',
      ].filter(Boolean).join(' · ') || undefined,
    },
    {
      key: 'booked',
      label: `Booked ${provider?.name || 'a provider'}`,
      at: at(job.acceptedProvider?.acceptedAt),
      detail: job.acceptedProvider?.agreedPrice ? `at ${formatCurrency(job.acceptedProvider.agreedPrice)}` : undefined,
    },
    { key: 'paid', label: job.paymentStatus === 'escrow_held' ? 'Paid into escrow' : 'Paid', at: at(job.paidAt), detail: job.paidAmount ? formatCurrency(job.paidAmount) : undefined },
    {
      key: 'dispute',
      label: `Dispute raised${job.completionStatus?.dispute?.raisedBy ? ` by the ${job.completionStatus.dispute.raisedBy}` : ''}`,
      at: at(job.completionStatus?.dispute?.raisedAt),
      tone: 'bg-amber-500',
    },
    {
      key: 'completed',
      label: 'Marked done',
      at: at(job.completionStatus?.completedAt),
      detail: [
        job.completionStatus?.clientConfirmed ? 'client confirmed' : '',
        job.completionStatus?.providerConfirmed ? 'provider confirmed' : '',
      ].filter(Boolean).join(' · ') || undefined,
      tone: 'bg-emerald-500',
    },
    {
      key: 'release',
      label: job.escrowStatus === 'released' || (job.escrowReleaseAt && new Date(job.escrowReleaseAt).getTime() < now) ? 'Payment released to the provider' : 'Payment releases to the provider',
      at: job.escrowStatus && !['none', 'refunded'].includes(job.escrowStatus) ? at(job.escrowReleaseAt) : null,
    },
    {
      key: 'cancelled',
      label: `Cancelled${job.cancellation?.cancelledBy ? ` by ${job.cancellation.cancelledBy}` : ''}`,
      at: at(job.cancellation?.cancelledAt),
      tone: 'bg-red-500',
    },
    { key: 'hidden', label: 'Hidden from listings', at: job.isHidden ? at(job.hiddenAt) : null, tone: 'bg-gray-400' },
    { key: 'deleted', label: 'Deleted', at: job.isDeleted ? at(job.deletedAt) : null, tone: 'bg-gray-400' },
  ] as { key: string; label: string; at: Date | null; detail?: string; tone?: string }[])
    .filter((e) => e.at && !Number.isNaN(e.at.getTime()))
    .sort((a, b) => a.at!.getTime() - b.at!.getTime());

  // WHERE.
  const address = (() => {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;
    return [loc.address, loc.barangay, loc.city, loc.province, loc.country].filter(Boolean).join(', ');
  })() || (job.locationDisplay && job.locationDisplay !== 'Location not specified' ? job.locationDisplay : '');
  const coords = (() => {
    if (!loc || typeof loc !== 'object') return null;
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') return `${loc.latitude},${loc.longitude}`;
    if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) return `${loc.coordinates[1]},${loc.coordinates[0]}`;
    if (Array.isArray(loc.coordinates?.coordinates) && loc.coordinates.coordinates.length === 2) return `${loc.coordinates.coordinates[1]},${loc.coordinates.coordinates[0]}`;
    return null;
  })();
  const mapsUrl = coords || address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords || address)}` : '';
  const clientArea = [(client as any)?.barangay, (client as any)?.city].filter(Boolean).join(', ');

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[90] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full md:w-[550px] bg-white z-[100] shadow-2xl flex flex-col" data-testid="job-panel">
        {/* Header: the job, where it stands, and what it's worth */}
        <div className="px-5 md:px-6 pt-4 pb-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
              <JobIcon src={iconSrc} className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-gray-400 tracking-wider truncate">{service}</p>
              <h3 className="text-lg font-black text-gray-900 leading-tight line-clamp-2">{job.title}</h3>
              <button
                onClick={() => copyToClipboard(job._id)}
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-gray-400 hover:text-blue-600 transition-colors"
                title="Copy the full job ID"
              >
                ID {job._id.slice(-8).toUpperCase()}
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <StatusBadge status={job.status} />
              <StatusLine job={job} className="text-[11px] max-w-full" />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">{jobPrice ? formatCurrency(jobPrice) : 'By quote'}</p>
              <p className="mt-1 text-[11px] text-gray-500">{jobPrice ? (priceIsQuote ? 'Agreed quote' : "Client's budget") : 'Set when a quote is accepted'}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {/* What needs attention, before anything else */}
          {(job.completionStatus?.dispute?.isActive || job.cancellation?.reason || job.isHidden || job.isDeleted) && (
            <div className="px-5 md:px-6 pt-4 space-y-2">
              {job.completionStatus?.dispute?.isActive && (
                <div data-testid="admin-job-active-dispute-banner" className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Active dispute — raised by {job.completionStatus.dispute.raisedBy || 'unknown'}
                    {job.completionStatus.dispute.raisedAt && <span className="font-normal text-amber-700"> · {formatDistanceToNow(new Date(job.completionStatus.dispute.raisedAt), { addSuffix: true })}</span>}
                  </p>
                  <p className="mt-1 text-xs text-amber-900">“{job.completionStatus.dispute.reason || 'No reason given'}”</p>
                  <p className="mt-1 text-[11px] text-amber-700">Resolve this from the Support inbox.</p>
                </div>
              )}
              {job.cancellation?.reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-bold text-red-800">
                    Cancellation{job.cancellation.cancelledBy ? ` · by ${job.cancellation.cancelledBy}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-red-900">“{job.cancellation.reason}”</p>
                  <p className="mt-1 text-[11px] text-red-700">
                    Fee applied: {job.cancellation.feeApplied ? formatCurrency(job.cancellation.feeApplied) : '₱0'}
                    {job.cancellation.cancelledAt && ` · ${format(new Date(job.cancellation.cancelledAt), 'MMM d, yyyy h:mm a')}`}
                  </p>
                </div>
              )}
              {(job.isHidden || job.isDeleted) && (
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {job.isDeleted ? <Trash2 className="h-3.5 w-3.5 mt-px text-red-500 flex-shrink-0" /> : <EyeOff className="h-3.5 w-3.5 mt-px text-orange-500 flex-shrink-0" />}
                  <p>
                    <span className="font-bold">{job.isDeleted ? 'Deleted' : 'Hidden'}</span>
                    {(job.isDeleted ? job.deletedAt : job.hiddenAt) && ` ${format(new Date((job.isDeleted ? job.deletedAt : job.hiddenAt)!), 'MMM d, yyyy')}`}
                    {job.isDeleted ? ' — removed from the client’s account. Restore it below.' : ' — not shown in search or browse. Unhide it below.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* WHO */}
          <PanelSection testId="job-section-who" icon={Users} label="People" description="Who posted it and who's doing it">
            <div className="space-y-2">
              <PartyCard
                role="Client"
                name={client?.name}
                image={client?.profileImage}
                verified={client?.isVerified}
                lines={[client?.phoneNumber || client?.phone, client?.email, clientArea].filter(Boolean) as string[]}
                id={client?._id}
              />
              {provider?.name ? (
                <PartyCard
                  role="Provider"
                  name={provider.name}
                  image={(provider as any).profileImage}
                  lines={[(provider as any).phoneNumber || (provider as any).phone, provider.email].filter(Boolean) as string[]}
                  id={provider._id}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 px-3 py-2.5">
                  <span className="h-10 w-10 rounded-full border border-dashed border-gray-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-indigo-600">Provider</p>
                    <p className="text-sm font-semibold text-gray-500">
                      {job.status === 'open' ? 'No provider booked yet' : job.acceptedProvider ? 'Booked (details unavailable)' : 'No provider was booked'}
                    </p>
                    {job.status === 'open' && (
                      <p className="text-[11px] text-gray-400">{quoteCount ? `${quoteCount} quote${quoteCount === 1 ? '' : 's'} waiting for the client` : 'Nobody has quoted yet'}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Quotes: the job's applicants in the app. Read-only — a client
                  accepts a quote in the app, which holds their payment in
                  escrow; the admin panel does not do that on their behalf.
                  Shown while the job is open or has quotes; a booked job
                  with none would only say "Quotes (0)". */}
              {(job.status === 'open' || loadingQuotes || quotes.length > 0) && (
              <button
                onClick={() => setShowQuotes(!showQuotes)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="min-w-0">
                  <span className="text-xs font-bold text-gray-900">Quotes ({loadingQuotes ? '…' : quotes.length})</span>
                  {!loadingQuotes && quotes.length > 0 && (
                    <span className="text-[11px] text-gray-500">
                      {lowest ? ` · lowest ${formatCurrency(lowest)}` : ''}{waitingQuotes ? ` · ${waitingQuotes} waiting` : ''}
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${showQuotes ? 'rotate-180' : ''}`} />
              </button>
              )}

              {showQuotes && (
                <div data-testid="admin-job-quotes">
                  {loadingQuotes ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : quotes.length > 0 ? (
                    <div className="space-y-1.5">
                      {quotes.map((quote) => (
                        <div
                          key={quote._id}
                          data-testid={`admin-job-quote-${quote._id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-indigo-600">{getInitials(quote.provider?.name || 'P')}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{quote.provider?.name || 'Unknown provider'}</p>
                              <p className="text-[11px] text-gray-500 truncate">
                                {quote.provider?.phoneNumber || quote.provider?.phone || quote.provider?.email || 'No contact info'}
                                {quote.submittedAt && ` · ${formatDistanceToNow(new Date(quote.submittedAt), { addSuffix: true })}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-sm font-black text-gray-900 tabular-nums">{quote.amount != null ? formatCurrency(quote.amount) : '—'}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${QUOTE_STATUS_STYLE[quote.status] || QUOTE_STATUS_STYLE.pending}`}>
                              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                      <p className="pt-1 text-[11px] text-gray-400">
                        The client accepts a quote in the app, which holds their payment in escrow.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                      No quotes yet
                    </div>
                  )}
                </div>
              )}
            </div>
          </PanelSection>

          {/* WHAT */}
          <PanelSection testId="job-section-what" icon={Briefcase} label="Job details" description="What's needed and what it pays">
            {job.description ? (
              <div>
                <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-line ${showFullDescription ? '' : 'line-clamp-4'}`}>{job.description}</p>
                {job.description.length > 220 && (
                  <button onClick={() => setShowFullDescription(!showFullDescription)} className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    {showFullDescription ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No description provided</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Fact label="Price" value={jobPrice ? formatCurrency(jobPrice) : 'By quote'} sub={jobPrice ? (priceIsQuote ? 'agreed quote' : "client's budget") : undefined} />
              <Fact label="Payment" value={job.paymentMethod === 'xendit' ? 'Xendit' : 'Wallet'} sub={paymentLine.text} subTone={paymentLine.tone} />
              <div className="col-span-2">
                <Fact label="Service" value={service} sub={job.categoryName && job.categoryName !== service ? job.categoryName : undefined} />
              </div>
            </div>

            {job.escrowStatus && job.escrowStatus !== 'none' && (
              <div data-testid="admin-job-escrow-card" className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 text-xs">
                  {/* The hold length is per-job, snapshotted at booking — an admin
                      deciding a dispute needs the terms this client actually
                      agreed to, not the current category setting. */}
                  <p data-testid="admin-job-escrow-status" className="font-bold text-blue-900 capitalize">
                    Escrow · Status: {job.escrowStatus}{job.escrowAmount ? ` · ${formatCurrency(job.escrowAmount)}` : ''}
                  </p>
                  <p data-testid="admin-job-service-class" className="mt-0.5 text-blue-700">
                    Terms: {terms.label} · held {formatReleaseWindow(job.paymentReleaseHours ?? terms.paymentReleaseHours)}
                  </p>
                  {job.escrowReleaseAt && (
                    <p data-testid="admin-job-escrow-release-date" className="mt-0.5 text-blue-700">
                      Release date: {format(new Date(job.escrowReleaseAt), 'MMM d, yyyy h:mm a')} ({formatDistanceToNow(new Date(job.escrowReleaseAt), { addSuffix: true })})
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Photos ({media.length})</p>
              {media.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(showAllMedia ? media : media.slice(0, 6)).map((url, index) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                      <ClickableImage
                        src={getImageKitMediaUrl(url)}
                        alt={`Job media ${index + 1}`}
                        className="w-full h-full object-cover"
                        imageType="credential"
                        title={`Job media ${index + 1}`}
                        modalClassName="md:right-[550px]"
                      />
                    </div>
                  ))}
                  {!showAllMedia && media.length > 6 && (
                    <button onClick={() => setShowAllMedia(true)} className="aspect-square rounded-lg border border-gray-200 bg-gray-50 text-xs font-bold text-gray-600 hover:bg-gray-100">
                      +{media.length - 6} more
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No photos attached</p>
              )}
            </div>
          </PanelSection>

          {/* WHEN */}
          <PanelSection testId="job-section-when" icon={Clock} label="Timeline" description="What happened and what's next">
            <ol className="space-y-3">
              {events.map((event, index) => {
                const upcoming = event.at!.getTime() > now;
                return (
                  <li key={event.key} className="relative flex gap-3" data-testid={`job-when-${event.key}`}>
                    {index < events.length - 1 && <span className="absolute left-[4px] top-3 bottom-[-12px] w-px bg-gray-200" aria-hidden="true" />}
                    <span
                      className={`relative mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white ${upcoming ? 'border-2 border-dashed border-blue-400 bg-white' : event.tone || 'bg-gray-400'}`}
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${upcoming ? 'text-blue-700' : 'text-gray-900'}`}>
                        {event.label}
                        {upcoming && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500">upcoming</span>}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {format(event.at!, 'MMM d, yyyy · h:mm a')} ({formatDistanceToNow(event.at!, { addSuffix: true })})
                      </p>
                      {event.detail && <p className="text-[11px] text-gray-500">{event.detail}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </PanelSection>

          {/* WHERE */}
          <PanelSection testId="job-section-where" icon={MapPin} label="Location" description="Where the work happens" last>
            {address ? (
              <div className="space-y-2">
                <p className="flex items-start gap-2 text-sm font-semibold text-gray-900">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>{address}</span>
                </p>
                {(full.locationDetails || job.locationDetails) && (
                  <p className="ml-6 rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2 text-xs text-amber-900">
                    <span className="font-bold">Note from the client:</span> {full.locationDetails || job.locationDetails}
                  </p>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-6 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Open in Google Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Location not specified</p>
            )}
          </PanelSection>
        </div>

      <div className="border-t border-gray-100 p-6 bg-white flex-shrink-0">
          <div className="flex gap-3">
            {job.isDeleted ? (
              <button
                onClick={() => setConfirmKind('restore')}
                className="flex-1 px-4 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restore Job
              </button>
            ) : (
              <>
                {job.isHidden ? (
                  <button
                    onClick={handleUnhideJob}
                    className="flex-1 px-4 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Unhide
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmKind('hide')}
                    className="flex-1 px-4 py-3.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 shadow-md shadow-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <EyeOff className="h-4 w-4" />
                    Hide Job
                  </button>
                )}
                <button
                  onClick={() => setConfirmKind('delete')}
                  className="flex-1 px-4 py-3.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>
          {!job.isHidden && !job.isDeleted && job.status !== 'cancelled' && job.status !== 'completed' && (
            <button
              onClick={() => setConfirmKind('cancel')}
              className="w-full mt-3 px-4 py-3 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              data-testid="admin-force-cancel-job-btn"
            >
              <XCircle className="h-4 w-4" />
              Cancel Job (release held payment)
            </button>
          )}
        </div>
      </div>

      {/* One confirmation sheet for hide / delete / restore / cancel. Docked to
          the bottom of this panel rather than centred on screen: the action
          belongs to the job on show, so it stays in the job's own column and
          leaves the ticket behind it readable. Scrim and sheet are clipped to
          the panel's width so nothing spills over the chat. */}
      {confirmConfig && (
        <>
          <div
            className="fixed inset-y-0 right-0 z-[200] w-full bg-black/40 md:w-[550px]"
            onClick={closeConfirm}
          />
          <div className="fixed bottom-0 right-0 z-[201] w-full md:w-[550px]">
            <div className="rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl">
              <div className="flex justify-center pt-2.5">
                <span className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <div className="flex items-start gap-3 px-5 pb-4 pt-3">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    confirmConfig.tone === 'red' ? 'bg-red-50' : 'bg-amber-50'
                  }`}
                >
                  <XCircle
                    className={`h-5 w-5 ${
                      confirmConfig.tone === 'red' ? 'text-red-600' : 'text-amber-600'
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900">
                    {confirmConfig.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    &ldquo;{job.title}&rdquo;
                  </p>
                </div>
              </div>

              <div className="space-y-3 px-5">
                <ul
                  className={`space-y-1.5 rounded-xl p-3 text-[12px] leading-relaxed ${
                    confirmConfig.tone === 'red'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {confirmConfig.consequences.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>

                {confirmConfig.reasonRequired && (
                  <div>
                    <label
                      htmlFor="confirm-reason"
                      className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500"
                    >
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="confirm-reason"
                      data-testid="force-cancel-reason"
                      value={confirmReason}
                      onChange={(e) => setConfirmReason(e.target.value)}
                      rows={3}
                      autoFocus
                      disabled={confirming}
                      placeholder="Why is this job being cancelled? Both parties will see this."
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                    />
                    {!confirmReason.trim() && (
                      <p className="mt-1 text-[11px] font-medium text-amber-700">
                        A reason is required — it goes in the activity log.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* pb clears the home indicator on gesture-nav devices. */}
              <div className="flex gap-2 px-5 pb-6 pt-4">
                <button
                  onClick={closeConfirm}
                  disabled={confirming}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  Keep job
                </button>
                <button
                  data-testid="confirm-destructive-action"
                  onClick={runConfirmedAction}
                  disabled={
                    confirming ||
                    (confirmConfig.reasonRequired && !confirmReason.trim())
                  }
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    confirmConfig.tone === 'red'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {confirming ? confirmConfig.busyLabel : confirmConfig.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
};

export default JobDetailsModal;
