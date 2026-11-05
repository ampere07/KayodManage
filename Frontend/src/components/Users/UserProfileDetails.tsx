import React from 'react';
import { BadgeCheck, Briefcase, Clock, Copy, Crown, MapPin, ShieldCheck, User as UserIcon, Wallet } from 'lucide-react';
import { format, differenceInDays, differenceInYears, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useUserStanding } from '../../hooks/useUsers';
import { formatPHPCurrency } from '../../utils/currency';
import { getProfessionDisplayName, professionKey, resolveIconForProfession } from '../../utils/professionUtils';
import PanelSection from '../UI/PanelSection';
import type { JobCategory, LegalAcceptance, User } from '../../types';

/**
 * The Profile tab's account details in the standard panel sections, in the
 * who → what → when → where order every details panel follows:
 *   Profile (who they are, how to reach them) · Work, Money and Standing (what
 *   they do, hold and owe, and how trustworthy the account looks) · Timeline
 *   (when things happened) · Location (where they live and work).
 * Facts sit in a two-column grid and counts in small tiles, so the panel's
 * width does the work instead of a long list.
 *
 * Member since, last seen and the client rating are not repeated here — the
 * "at a glance" tiles above already show them.
 *
 * Most of it comes from the user document itself — including the fields the
 * Kayod app writes that the admin schema never declared (bio, sign-up method,
 * premium, service area, credentials, fee standing, cancellation strikes).
 * Reports and support counts come from GET /api/users/:id/standing.
 */

interface UserProfileDetailsProps {
  user: User;
  jobCategories: JobCategory[];
  verification: { reviewedBy?: string | null; reviewedAt?: string | Date | null; loading: boolean };
  /** Restrictions, suspensions and bans on record, and active warnings (the panel loads them). */
  penalties?: { loading: boolean; total: number; warnings: number };
  /** The restriction on file and dispute findings, shown under Standing. */
  securityAudit?: React.ReactNode;
  /** The agreements this user accepted, shown in the Timeline. */
  legalAcceptances?: LegalAcceptance[];
}

const dateOnly = (value?: string | Date | null) => (value ? format(new Date(value), 'MMM d, yyyy') : null);
const peso = (amount?: number | null) => formatPHPCurrency(amount || 0);

const copy = (value: string, label: string) =>
  navigator.clipboard.writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error(`Failed to copy ${label.toLowerCase()}`));

/** A fact in the two-column grid: small label above, value below. */
const Fact: React.FC<{ label: string; children?: React.ReactNode; empty?: boolean; sub?: React.ReactNode; wide?: boolean }> = ({ label, children, empty, sub, wide }) => (
  <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className={`text-sm mt-0.5 break-words ${empty ? 'text-gray-400' : 'font-semibold text-gray-900'}`}>{empty ? 'Not provided' : children}</dd>
    {sub && !empty && <dd className="text-[11px] text-gray-400">{sub}</dd>}
  </div>
);

const Facts: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
);

/** A count in a small tile. `tone` only when the number calls for attention. */
const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'alert' | 'warn' | 'good' }> = ({ label, value, sub, tone }) => {
  const palette = tone === 'alert'
    ? 'border-red-100 bg-red-50/60 text-red-700'
    : tone === 'warn'
      ? 'border-amber-100 bg-amber-50/60 text-amber-700'
      : tone === 'good'
        ? 'border-green-100 bg-green-50/60 text-green-700'
        : 'border-gray-100 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-3 min-w-0 ${palette}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-base font-black mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
};

const CopyValue: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <button type="button" onClick={() => copy(value, label)} title={`Copy ${label.toLowerCase()}`} className="inline-flex items-center gap-1.5 hover:text-blue-600 text-left break-all">
    {value}
    <Copy className="w-3 h-3 text-gray-300 flex-shrink-0" />
  </button>
);

const Chips: React.FC<{ items: string[]; tone?: string }> = ({ items, tone = 'bg-white text-gray-700 border-gray-200' }) => (
  <span className="flex flex-wrap gap-1">
    {items.map((item) => (
      <span key={item} className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${tone}`}>{item}</span>
    ))}
  </span>
);

// Profession icons live on ImageKit; fall back to the initial when one won't load.
const ProfessionIcon: React.FC<{ src: string; name: string }> = ({ src, name }) => {
  const [failed, setFailed] = React.useState(false);
  return (
    <span className="w-8 h-8 rounded-lg bg-indigo-50/60 border border-indigo-100/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {failed || !src ? (
        <span className="text-xs font-bold text-indigo-600">{name.charAt(0).toUpperCase()}</span>
      ) : (
        <img src={src} alt="" className="w-5 h-5 object-contain" onError={() => setFailed(true)} />
      )}
    </span>
  );
};

const CREDENTIAL_STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: 'Verified', className: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  under_review: { label: 'In review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const UserProfileDetails: React.FC<UserProfileDetailsProps> = ({ user, jobCategories, verification, penalties, securityAudit, legalAcceptances = [] }) => {
  const isProvider = user.userType === 'provider';
  const standing = useUserStanding(user._id);
  const now = new Date();

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
  const phone = user.phoneNumberWithCountryCode || user.phoneNumber || user.phone;
  const signUp = user.isGoogleUser ? 'Google' : user.isFacebookUser ? 'Facebook' : user.isAuth0User ? 'Auth0' : 'Password';
  const premiumActive = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > now);
  const addresses = user.addresses || [];
  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
  const serviceCenter = user.serviceArea?.center?.city || user.serviceArea?.center?.name;

  // Professions with their credential row, keyed so repeated spellings collapse.
  const professions = (() => {
    if (!isProvider) return [];
    const raws = new Map<string, string>();
    const add = (value?: string | string[] | null) =>
      (Array.isArray(value) ? value : String(value || '').split(','))
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => { if (!raws.has(professionKey(name))) raws.set(professionKey(name), name); });
    add(user.jobCategories);
    add(user.categories);
    (user.jobVerificationStatus || []).forEach((entry) => add(entry.category));
    // `category` usually holds the parent category ("Home Repair"), not a profession.
    if (!jobCategories.some((c) => professionKey(c.name) === professionKey(user.category || ''))) add(user.category);
    return [...raws].map(([key, raw]) => {
      const name = getProfessionDisplayName(raw, jobCategories);
      // The category this profession is configured under; null when the value
      // is itself a category name or no longer configured.
      const category = jobCategories.find((c) => c.professions?.some((p) => professionKey(p.name) === key));
      return {
        key,
        name,
        category: category && professionKey(category.name) !== key ? category.name : null,
        icon: resolveIconForProfession(name, jobCategories).imagePath,
        credential: (user.jobVerificationStatus || []).find((entry) => professionKey(entry.category) === key),
      };
    });
  })();
  const verifiedCount = professions.filter((p) => p.credential?.status === 'approved').length;
  const availability =
    user.availability && user.availability.trim().toLowerCase() !== 'contact for availability' ? user.availability.trim() : null;

  const fee = user.feeStatus;
  const strikes = user.cancellationStrikes;
  const lastStrike = strikes?.history?.length ? strikes.history[strikes.history.length - 1] : null;
  const identityStatus = user.isVerified
    ? 'Verified'
    : ({ pending: 'Pending review', rejected: 'Rejected', resubmission_requested: 'Resubmission requested', flagged: 'Flagged' } as Record<string, string>)[
        String((user as { credentialVerificationStatus?: string }).credentialVerificationStatus)
      ] || 'Not verified';
  const reviewedLine = user.isVerified && !verification.loading
    ? [verification.reviewedBy && `by ${verification.reviewedBy}`, dateOnly(verification.reviewedAt)].filter(Boolean).join(' · ')
    : '';
  const pendingCount = (n?: number) => (standing.data ? n : standing.isError ? '—' : '…');

  // When: the account's dated events, in order; future ones are marked upcoming.
  const restriction = user.restrictionDetails;
  const restrictionWord = ({ restricted: 'restricted', suspended: 'suspended', banned: 'banned', deleted: 'deleted' } as Record<string, string>)[
    String(restriction?.type || user.accountStatus || '')
  ] || 'restricted';
  const restrictionEnds = restriction?.suspendedUntil || restriction?.expiresAt;
  const events = ([
    { key: 'joined', label: 'Joined Kayod', at: user.createdAt, detail: `signed up with ${signUp}` },
    { key: 'verified', label: 'Identity verified', at: user.isVerified ? verification.reviewedAt : null, detail: verification.reviewedBy ? `by ${verification.reviewedBy}` : undefined },
    { key: 'login', label: 'Last signed in', at: user.lastLogin },
    { key: 'restricted', label: `Account ${restrictionWord}`, at: user.accountStatus && user.accountStatus !== 'active' ? restriction?.restrictedAt : null, tone: 'bg-red-500' },
    { key: 'restriction-ends', label: restrictionEnds && new Date(restrictionEnds) > now ? `${restrictionWord.replace(/^\w/, (c) => c.toUpperCase())} until` : 'Restriction ended', at: user.accountStatus && user.accountStatus !== 'active' ? restrictionEnds : null },
    { key: 'premium', label: user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now ? 'Premium ends' : 'Premium ended', at: user.isPremium ? user.premiumExpiresAt : null, tone: 'bg-amber-400' },
    { key: 'fee-paid', label: 'Last fee paid', at: isProvider ? fee?.lastFeePayment : null },
    { key: 'fee-unpaid', label: 'Fee left unpaid', at: isProvider && (fee?.unpaidFees || 0) > 0 ? fee?.lastUnpaidDate : null, tone: 'bg-amber-500' },
    { key: 'strike', label: 'Cancellation strike', at: lastStrike?.cancelledAt, detail: lastStrike?.ratingDeducted ? `−${lastStrike.ratingDeducted}★` : undefined, tone: 'bg-amber-500' },
  ] as { key: string; label: string; at?: string | Date | null; detail?: string; tone?: string }[])
    .filter((event) => event.at && !Number.isNaN(new Date(event.at).getTime()))
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
  const agreements = legalAcceptances.slice().sort((a, b) => new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime());

  return (
    <div data-testid="user-profile-details">
      {/* Who */}
      <PanelSection icon={UserIcon} label="Profile" description="Who they are and how to reach them" testId="user-about">
        {user.bio && (
          <p className="text-sm text-gray-700 italic bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-line">“{user.bio}”</p>
        )}
        <Facts>
          <Fact label="Full name">{fullName}</Fact>
          <Fact label="Account type">{isProvider ? 'Service provider' : 'Customer'}</Fact>
          <Fact label="Email" wide><span data-testid="user-contact-email"><CopyValue value={user.email} label="Email" /></span></Fact>
          <Fact label="Phone" empty={!phone}>{phone && <CopyValue value={phone} label="Phone number" />}</Fact>
          <Fact label="Date of birth" empty={!user.dateOfBirth} sub={user.dateOfBirth ? `${differenceInYears(now, new Date(user.dateOfBirth))} years old` : undefined}>
            {dateOnly(user.dateOfBirth)}
          </Fact>
          <Fact label="Signed up with">{signUp}</Fact>
          <Fact label="Premium" sub={user.isPremium && user.premiumExpiresAt ? `${premiumActive ? 'Until' : 'Expired'} ${dateOnly(user.premiumExpiresAt)}` : undefined}>
            {premiumActive ? <span className="inline-flex items-center gap-1 text-amber-600"><Crown className="w-3.5 h-3.5" />Premium</span> : user.isPremium ? 'Lapsed' : 'No'}
          </Fact>
          {user.referralCode && <Fact label="Referral code"><CopyValue value={user.referralCode} label="Referral code" /></Fact>}
          {user.languages?.length ? <Fact label="Languages" wide><Chips items={user.languages} /></Fact> : null}
        </Facts>
      </PanelSection>

      {/* What */}
      {isProvider && (
        <PanelSection icon={Briefcase} label="Work" description="What they offer and how they take jobs" testId="user-work-profile">
          {/* Status on one line: are they taking work, and how fast do they answer. */}
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                user.acceptingJobs === false ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${user.acceptingJobs === false ? 'bg-red-500' : 'bg-green-500'}`} />
              {user.acceptingJobs === false ? 'Not accepting jobs' : 'Accepting jobs'}
            </span>
            {user.averageResponseTime && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-white text-gray-700 border-gray-200">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Responds {user.averageResponseTime.charAt(0).toLowerCase() + user.averageResponseTime.slice(1)}
              </span>
            )}
          </div>
          {/* "Contact for availability" is the app's default for every provider — only show what they actually wrote. */}
          {availability && (
            <p className="text-xs text-gray-500 mt-2">Availability: <span className="text-gray-800 font-medium">{availability}</span></p>
          )}

          <div className="mt-4" data-testid="user-professions">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-500">
                Professions <span className="text-gray-400 font-normal">({professions.length})</span>
              </p>
              {professions.length > 0 && (
                <p className={`text-[11px] font-semibold ${verifiedCount === professions.length ? 'text-green-700' : 'text-gray-500'}`}>
                  {verifiedCount} of {professions.length} verified
                </p>
              )}
            </div>
            {professions.length === 0 ? (
              <p className="text-sm text-gray-400">No professions listed.</p>
            ) : (
              <ul className="rounded-lg border border-gray-100 bg-white divide-y divide-gray-100">
                {professions.map(({ key, name, category, icon, credential }) => {
                  const status = credential?.status && credential.status !== 'none' ? credential.status : null;
                  const expires = credential?.expiresAt ? new Date(credential.expiresAt) : null;
                  const daysLeft = expires ? differenceInDays(expires, now) : null;
                  const details = [
                    credential?.certificationType,
                    credential?.certificateNumber ? `No. ${credential.certificateNumber}` : null,
                    credential?.verifiedAt ? `verified ${dateOnly(credential.verifiedAt)}` : null,
                  ].filter(Boolean);
                  return (
                    <li key={key} className="flex items-start gap-3 px-3 py-2.5">
                      <ProfessionIcon src={icon} name={name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                            {category && <p className="text-[11px] text-gray-500 truncate">{category}</p>}
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0 inline-flex items-center gap-1 ${
                              status ? CREDENTIAL_STATUS[status]?.className || 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}
                          >
                            {status === 'approved' && <BadgeCheck className="w-3 h-3" />}
                            {status ? CREDENTIAL_STATUS[status]?.label || status : 'Not verified'}
                          </span>
                        </div>
                        {/* Credential on its own line and allowed to wrap, so the expiry is never cut off. */}
                        {(details.length > 0 || expires) && (
                          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                            {details.map((detail, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && ' · '}
                                <span className="whitespace-nowrap">{detail}</span>
                              </React.Fragment>
                            ))}
                            {expires && (
                              <>
                                {details.length ? ' · ' : ''}
                                <span className={`whitespace-nowrap ${daysLeft! < 0 ? 'text-red-600 font-semibold' : daysLeft! <= 30 ? 'text-amber-600 font-semibold' : ''}`}>
                                  {daysLeft! < 0 ? `expired ${dateOnly(expires)}` : `expires ${dateOnly(expires)}`}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {(user.skills?.length || user.certifications?.length) ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
              {user.skills?.length ? <Fact label="Skills"><Chips items={user.skills} /></Fact> : null}
              {user.certifications?.length ? <Fact label="Certifications"><Chips items={user.certifications} tone="bg-indigo-50 text-indigo-700 border-indigo-100" /></Fact> : null}
            </dl>
          ) : null}
        </PanelSection>
      )}

      <PanelSection icon={Wallet} label="Money" description="What's in their wallet and what they owe" testId="user-money-summary">
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Wallet"
            value={peso(user.wallet?.balance)}
            sub={user.wallet && user.wallet.heldBalance > 0 ? `${peso(user.wallet.heldBalance)} held` : 'none held'}
          />
          <Stat
            label="Topped up"
            value={peso(user.financials?.topUpTotal)}
            sub={user.financials?.topUpPending ? `+${peso(user.financials.topUpPending)} pending` : undefined}
          />
          <Stat
            label="Cashed out"
            value={peso(user.financials?.cashOutTotal)}
            sub={user.financials?.cashOutPending ? `+${peso(user.financials.cashOutPending)} pending` : undefined}
          />
        </div>
        {isProvider && fee && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Stat
              label="Unpaid fees"
              value={peso(fee.unpaidFees)}
              tone={(fee.unpaidFees || 0) > 0 ? (fee.restrictionLevel === 'restricted' ? 'alert' : 'warn') : undefined}
              sub={fee.restrictionLevel && fee.restrictionLevel !== 'none'
                ? `${fee.restrictionLevel}${fee.warningCount ? ` · ${fee.warningCount} warning${fee.warningCount === 1 ? '' : 's'}` : ''}`
                : fee.lastUnpaidDate ? `since ${dateOnly(fee.lastUnpaidDate)}` : undefined}
            />
            <Stat label="Fees paid" value={peso(fee.totalFeesPaid)} sub={fee.lastFeePayment ? `last ${dateOnly(fee.lastFeePayment)}` : undefined} />
          </div>
        )}
      </PanelSection>

      <PanelSection icon={ShieldCheck} label="Standing" description="Verification, reports and penalties" testId="user-standing">
        <p className="text-sm mb-3">
          <span className="text-gray-500 text-xs">Identity: </span>
          <span className={`font-semibold ${user.isVerified ? 'text-green-700' : 'text-amber-600'}`}>{identityStatus}</span>
          {reviewedLine && <span className="text-[11px] text-gray-400"> · {reviewedLine}</span>}
        </p>
        {/* Every count in one grid, then the restriction on file and dispute findings. */}
        <div data-testid="user-security-audit">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat
              label="Reports against"
              value={pendingCount(standing.data?.reportsAgainst.total)}
              tone={standing.data && standing.data.reportsAgainst.total > 0 ? 'alert' : undefined}
              sub={standing.data && standing.data.reportsAgainst.open > 0 ? `${standing.data.reportsAgainst.open} still open` : undefined}
            />
            <Stat label="Reports filed" value={pendingCount(standing.data?.reportsFiled)} />
            <Stat
              label="Support tickets"
              value={pendingCount(standing.data?.support.total)}
              sub={standing.data && standing.data.support.open > 0 ? `${standing.data.support.open} open` : undefined}
            />
            <Stat
              label="Cancel strikes"
              value={strikes?.count || 0}
              tone={(strikes?.count || 0) > 0 ? 'warn' : undefined}
              sub={lastStrike?.cancelledAt ? `last ${dateOnly(lastStrike.cancelledAt)}${lastStrike.ratingDeducted ? ` · −${lastStrike.ratingDeducted}★` : ''}` : undefined}
            />
            {/* Restrictions, suspensions and bans — the count GET /users/:id/penalties returns. */}
            <Stat
              label="Penalties"
              value={!penalties || penalties.loading ? '…' : penalties.total}
              tone={penalties && !penalties.loading && penalties.total > 0 ? 'alert' : undefined}
            />
            <Stat
              label="Warnings"
              value={!penalties || penalties.loading ? '…' : penalties.warnings}
              tone={penalties && !penalties.loading && penalties.warnings > 0 ? 'warn' : undefined}
            />
          </div>
          <div className="mt-3 space-y-3 empty:hidden">{securityAudit}</div>
        </div>
      </PanelSection>

      {/* When */}
      <PanelSection icon={Clock} label="Timeline" description="When things happened on this account" testId="user-timeline">
        <ol className="space-y-3">
          {events.map((event, index) => {
            const at = new Date(event.at!);
            const upcoming = at.getTime() > now.getTime();
            return (
              <li key={event.key} className="relative flex gap-3" data-testid={`user-when-${event.key}`}>
                {index < events.length - 1 && <span className="absolute left-[4px] top-3 bottom-[-12px] w-px bg-gray-200" aria-hidden="true" />}
                <span className={`relative mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white ${upcoming ? 'border-2 border-dashed border-blue-400 bg-white' : event.tone || 'bg-gray-400'}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${upcoming ? 'text-blue-700' : 'text-gray-900'}`}>
                    {event.label}
                    {upcoming && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500">upcoming</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">{format(at, 'MMM d, yyyy · h:mm a')} ({formatDistanceToNow(at, { addSuffix: true })})</p>
                  {event.detail && <p className="text-[11px] text-gray-500">{event.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Legal agreements. Appended by the Kayod server whenever this user
            affirms the agreements — at sign-up, at booking, when posting a job.
            Never edited here: it is an audit trail, and a mutable one proves
            nothing. Empty for accounts created before acceptances were
            recorded, which is meaningful in itself and so is said plainly. */}
        <div className="mt-4" data-testid="user-legal">
          <p className="text-[11px] font-semibold text-gray-500 mb-2">
            Legal agreements <span className="text-gray-400 font-normal">({agreements.length})</span>
          </p>
          {agreements.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              No recorded acceptances. Accounts created before agreement tracking was added will show nothing here.
            </p>
          ) : (
            <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100">
              {agreements.map((entry, index) => (
                <li key={`${entry.acceptedAt}-${index}`} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-900 capitalize">{String(entry.context || '').replace('-', ' ')}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">v{entry.version}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{entry.acceptedAt ? new Date(entry.acceptedAt).toLocaleString() : '—'}</p>
                  {Array.isArray(entry.documentIds) && entry.documentIds.length > 0 ? (
                    <p className="text-[11px] text-gray-400 mt-0.5">{entry.documentIds.join(', ')}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelSection>

      {/* Where */}
      <PanelSection icon={MapPin} label="Location" description="Where they live and work" testId="user-location" last>
        <Facts>
          <Fact label="Location" empty={!user.location} wide>{user.location}</Fact>
          {addresses.length > 0 && (
            <Fact label="Saved addresses" sub={addresses.length > 1 ? `${addresses.length} saved` : undefined}>
              {defaultAddress?.name}{defaultAddress?.city ? ` · ${defaultAddress.city}` : ''}
            </Fact>
          )}
          {isProvider && user.serviceArea?.radius != null && (
            <Fact label="Service area">{user.serviceArea.radius} km{serviceCenter ? ` around ${serviceCenter}` : ''}</Fact>
          )}
        </Facts>
      </PanelSection>
    </div>
  );
};

export default UserProfileDetails;
