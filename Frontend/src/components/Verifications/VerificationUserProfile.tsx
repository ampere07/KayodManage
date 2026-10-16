import React from 'react';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Flag,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Star,
  XCircle
} from 'lucide-react';
import { differenceInYears, format, formatDistanceToNowStrict } from 'date-fns';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useUserDetails, useUserFinancials, useUserJobs } from '../../hooks/useUsers';
import { settingsService } from '../../services/settingsService';
import { getProfessionDisplayName, professionKey } from '../../utils/professionUtils';
import type { JobCategory, UserInfo, Verification } from '../../types';

interface VerificationUserProfileProps {
  /** The populated userId from the verification — always there, even before the full record loads. */
  user: UserInfo;
  verification: Verification;
  attemptCount: number;
  /** The attempt the documents column is showing; the checklist describes that attempt. */
  selectedAttempt: number;
  documents: { faceVerification: boolean; validId: boolean; credentials: number };
}

const peso = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 })
    .format(amount || 0)
    .replace('PHP', '₱');

const dateOnly = (value?: string | Date | null) => (value ? format(new Date(value), 'MMM d, yyyy') : null);
const ago = (value?: string | Date | null) =>
  value ? formatDistanceToNowStrict(new Date(value), { addSuffix: true }) : null;

const copy = (value: string, label: string) => {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
};

const Card: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-4">
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{title}</h4>
      {action}
    </div>
    {children}
  </section>
);

/** Label on the left, value on the right; `muted` for "Not provided". */
const Row: React.FC<{ label: string; children: React.ReactNode; muted?: boolean }> = ({ label, children, muted }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
    <span className="text-gray-500 flex-shrink-0">{label}</span>
    <span className={`text-right min-w-0 break-words ${muted ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>{children}</span>
  </div>
);

const Skeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2.5 animate-pulse">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${85 - i * 12}%` }} />
    ))}
  </div>
);

const ACCOUNT_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
  restricted: { label: 'Restricted', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  suspended: { label: 'Suspended', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  banned: { label: 'Banned', className: 'bg-red-50 text-red-700 border-red-200' },
  deleted: { label: 'Deleted', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const PROFESSION_STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: 'Verified', className: 'text-green-700' },
  pending: { label: 'Pending', className: 'text-amber-600' },
  under_review: { label: 'In review', className: 'text-amber-600' },
  rejected: { label: 'Rejected', className: 'text-red-600' },
  resubmission_requested: { label: 'Resubmit', className: 'text-orange-600' },
  flagged: { label: 'Flagged', className: 'text-purple-600' },
  expired: { label: 'Expired', className: 'text-gray-500' },
};

/** Where the review stands, who decided it, and what they wrote. */
const ReviewBanner: React.FC<{ verification: Verification; attemptCount: number }> = ({ verification, attemptCount }) => {
  const reviewer = verification.reviewedBy?.name || 'an admin';
  const reviewed = verification.reviewedAt ? `${reviewer} · ${dateOnly(verification.reviewedAt)}` : reviewer;
  const waiting = ['pending', 'under_review'].includes(verification.status);
  const config = waiting
    ? { icon: Clock, className: 'bg-amber-50 border-amber-200 text-amber-800', title: 'Awaiting review', detail: `Submitted ${ago(verification.submittedAt)}` }
    : ({
        approved: { icon: ShieldCheck, className: 'bg-green-50 border-green-200 text-green-800', title: 'Approved', detail: `By ${reviewed}` },
        rejected: { icon: XCircle, className: 'bg-red-50 border-red-200 text-red-800', title: 'Rejected', detail: `By ${reviewed}` },
        resubmission_requested: { icon: RotateCcw, className: 'bg-orange-50 border-orange-200 text-orange-800', title: 'Resubmission requested', detail: `By ${reviewed}` },
        flagged: { icon: Flag, className: 'bg-purple-50 border-purple-200 text-purple-800', title: 'Flagged for review', detail: `By ${reviewed}` },
      } as const)[verification.status as 'approved' | 'rejected' | 'resubmission_requested' | 'flagged'];
  if (!config) return null;
  const Icon = config.icon;
  // The approve action writes this boilerplate note; it adds nothing to the banner.
  const notes = verification.adminNotes && !/^Approved by admin$/i.test(verification.adminNotes) ? verification.adminNotes : null;

  return (
    <div className={`rounded-xl border p-4 ${config.className}`} data-testid="verification-review-banner">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold">{config.title}</p>
          <p className="text-xs opacity-80">
            {config.detail}
            {attemptCount > 1 && ` · attempt ${attemptCount}`}
          </p>
          {verification.rejectionReason && (
            <p className="text-xs pt-1"><span className="font-semibold">Reason:</span> “{verification.rejectionReason}”</p>
          )}
          {notes && <p className="text-xs"><span className="font-semibold">Admin notes:</span> {notes}</p>}
        </div>
      </div>
    </div>
  );
};

const VerificationUserProfile: React.FC<VerificationUserProfileProps> = ({ user, verification, attemptCount, selectedAttempt, documents }) => {
  const details = useUserDetails(user._id);
  const jobs = useUserJobs(user._id, { page: 1, limit: 1, role: 'all' });
  const money = useUserFinancials(user._id);
  const full = details.data;
  // The jobs/money hooks keep the previous user's data as a placeholder; showing
  // it under this user's name would be wrong, so it counts as still loading.
  const jobsReady = jobs.data && !jobs.isPlaceholderData;
  const moneyReady = money.data && !money.isPlaceholderData;

  const isProvider = (full?.userType || user.userType) === 'provider';
  // Same query key as the Users page and Settings, so it is shared and refreshed on edits.
  const { data: categoriesData } = useQuery({ queryKey: ['job-categories'], queryFn: () => settingsService.getJobCategories() });
  const jobCategories: JobCategory[] = React.useMemo(() => categoriesData?.categories || [], [categoriesData]);
  const phone = full?.phone || full?.phoneNumber;
  const status = full?.accountStatus || (full?.isRestricted ? 'restricted' : 'active');
  const restriction = full?.restrictionDetails;
  // Users store professions as keys ("autoMechanic"); show the name configured in
  // Settings > Job Category. Keyed by professionKey so "autoMechanic" in one field
  // and "Auto Mechanic" in another are one profession, and its verification
  // status is found whichever spelling jobVerificationStatus used.
  const professions = React.useMemo(() => {
    if (!full) return [];
    const raws = new Map<string, string>();
    const add = (value?: string | string[] | null) =>
      (Array.isArray(value) ? value : String(value || '').split(','))
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => { if (!raws.has(professionKey(name))) raws.set(professionKey(name), name); });
    add(full.categories);
    add(full.jobCategories);
    // `category` usually holds the parent category ("Home Repair"), not a profession.
    if (!jobCategories.some((c) => professionKey(c.name) === professionKey(full.category || ''))) add(full.category);
    (full.jobVerificationStatus || []).forEach((entry) => add(entry.category));
    return [...raws].map(([key, raw]) => ({
      key,
      name: getProfessionDisplayName(raw, jobCategories),
      status: (full.jobVerificationStatus || []).find((entry) => professionKey(entry.category) === key)?.status,
    }));
  }, [full, jobCategories]);
  const rating = Number((full as { ratings?: number } | undefined)?.ratings) || 0;

  return (
    <div className="space-y-4" data-testid="verification-user-profile">
      <ReviewBanner verification={verification} attemptCount={attemptCount} />

      <Card
        title="Account"
        action={full && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ACCOUNT_STATUS[status]?.className || ACCOUNT_STATUS.active.className}`}>
            {ACCOUNT_STATUS[status]?.label || status}
          </span>
        )}
      >
        {details.isLoading ? <Skeleton lines={3} /> : details.isError ? (
          <p className="text-sm text-gray-500">Couldn’t load the full account record.</p>
        ) : full && (
          <>
            {restriction && status !== 'active' && (
              <div className="mb-2 rounded-lg bg-orange-50 border border-orange-100 p-2.5 text-xs text-orange-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                {restriction.reason || 'No reason recorded'}
                {(restriction.suspendedUntil || restriction.expiresAt) && (
                  <span className="block mt-0.5 opacity-80">
                    Until {dateOnly(restriction.suspendedUntil || restriction.expiresAt)}
                  </span>
                )}
              </div>
            )}
            <Row label="Member since">
              {dateOnly(full.createdAt || user.createdAt)}
              <span className="text-gray-400 font-normal"> ({formatDistanceToNowStrict(new Date(full.createdAt || user.createdAt || Date.now()))})</span>
            </Row>
            {/* Stamped only on an actual sign-in, so "last login" — not "last seen". */}
            <Row label="Last login" muted={!full.lastLogin}>
              {full.lastLogin ? ago(full.lastLogin) : 'Never logged in'}
            </Row>
            <Row label="Account type">{isProvider ? 'Service provider' : 'Customer'}</Row>
          </>
        )}
      </Card>

      <Card title="Personal & contact">
        <Row label="Full name">{user.name}</Row>
        {details.isLoading ? <Skeleton lines={3} /> : (
          <>
            <Row label="Birthdate" muted={!full?.dateOfBirth}>
              {full?.dateOfBirth
                ? <>{dateOnly(full.dateOfBirth)} <span className="text-gray-400 font-normal">({differenceInYears(new Date(), new Date(full.dateOfBirth))} yrs)</span></>
                : 'Not provided'}
            </Row>
            <Row label="Email">
              <button type="button" onClick={() => copy(user.email, 'Email')} className="inline-flex items-center gap-1.5 hover:text-blue-600 text-right break-all" title="Copy email">
                <Mail className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />{user.email}<Copy className="w-3 h-3 flex-shrink-0 text-gray-300" />
              </button>
            </Row>
            <Row label="Phone" muted={!phone}>
              {phone ? (
                <button type="button" onClick={() => copy(phone, 'Phone number')} className="inline-flex items-center gap-1.5 hover:text-blue-600" title="Copy phone number">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />{phone}<Copy className="w-3 h-3 text-gray-300" />
                </button>
              ) : 'Not provided'}
            </Row>
            <Row label="Location" muted={!full?.location}>
              {full?.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{full.location}</span> : 'Not provided'}
            </Row>
          </>
        )}
      </Card>

      {isProvider && (
        <Card
          title="Professions"
          action={rating > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{rating.toFixed(1)}</span>
          )}
        >
          {details.isLoading ? <Skeleton lines={2} /> : professions.length === 0 ? (
            <p className="text-sm text-gray-400">No professions listed.</p>
          ) : (
            <ul className="space-y-1.5">
              {professions.map(({ key, name, status: professionStatus }) => (
                <li key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-gray-900 font-medium"><Briefcase className="w-3.5 h-3.5 text-gray-400" />{name}</span>
                  {professionStatus && (
                    <span className={`text-[11px] font-bold ${PROFESSION_STATUS[professionStatus]?.className || 'text-gray-500'}`}>
                      {PROFESSION_STATUS[professionStatus]?.label || professionStatus}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Track record">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Posted', value: jobsReady ? jobs.data!.summary.posted : null },
            { label: 'Worked', value: jobsReady ? jobs.data!.summary.worked : null },
            { label: 'Completed', value: jobsReady ? jobs.data!.summary.byStatus?.completed || 0 : null },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 py-2 text-center">
              <p className="text-lg font-black text-gray-900 leading-none">{value ?? '—'}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">{label}</p>
            </div>
          ))}
        </div>
        {jobsReady && (jobs.data!.summary.byStatus?.cancelled || 0) > 0 && (
          <Row label="Cancelled (posted)">{jobs.data!.summary.byStatus.cancelled}</Row>
        )}
        {moneyReady ? (
          <>
            <Row label="Topped up">
              {peso(money.data!.topUp.total)}
              {money.data!.topUp.pending > 0 && <span className="text-amber-600 font-normal"> +{peso(money.data!.topUp.pending)} pending</span>}
            </Row>
            <Row label="Cashed out">
              {peso(money.data!.cashOut.total)}
              {money.data!.cashOut.pending > 0 && <span className="text-amber-600 font-normal"> +{peso(money.data!.cashOut.pending)} pending</span>}
            </Row>
          </>
        ) : money.isError ? null : <Skeleton lines={2} />}
        {full?.wallet && (
          <Row label="Wallet balance">
            {peso(full.wallet.balance)}
            {full.wallet.heldBalance > 0 && <span className="text-gray-400 font-normal"> ({peso(full.wallet.heldBalance)} held)</span>}
          </Row>
        )}
      </Card>

      <Card title="Documents" action={<span className="text-[11px] font-bold text-indigo-600">Attempt {selectedAttempt} of {attemptCount}</span>}>
        <ul className="space-y-1.5 text-sm">
          {[
            { label: 'Face verification', present: documents.faceVerification },
            { label: 'Valid ID', present: documents.validId },
            {
              label: documents.credentials > 0 ? `Credentials (${documents.credentials} file${documents.credentials === 1 ? '' : 's'})` : 'Credentials',
              present: documents.credentials > 0,
            },
          ].map(({ label, present }) => (
            <li key={label} className={`flex items-center gap-2 ${present ? 'text-gray-900' : 'text-gray-400'}`}>
              {present ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-300" />}
              {label}
              {!present && <span className="text-[11px]">— not uploaded</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default VerificationUserProfile;
