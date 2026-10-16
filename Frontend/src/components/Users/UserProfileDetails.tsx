import React from 'react';
import { BadgeCheck, Briefcase, Clock, Copy, Crown, Phone, ShieldCheck, User as UserIcon, Wallet } from 'lucide-react';
import { format, differenceInDays, differenceInYears } from 'date-fns';
import toast from 'react-hot-toast';
import { useUserStanding } from '../../hooks/useUsers';
import { formatPHPCurrency } from '../../utils/currency';
import { getProfessionDisplayName, professionKey, resolveIconForProfession } from '../../utils/professionUtils';
import type { JobCategory, User } from '../../types';

/**
 * The Profile tab's account details, grouped the way an admin reads an account:
 * who they are, how to reach them, the work they offer, their money, and how
 * trustworthy the account looks. Facts sit in a two-column grid and counts in
 * small tiles, so the panel's width does the work instead of a long list.
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
}

const dateOnly = (value?: string | Date | null) => (value ? format(new Date(value), 'MMM d, yyyy') : null);
const peso = (amount?: number | null) => formatPHPCurrency(amount || 0);

const copy = (value: string, label: string) =>
  navigator.clipboard.writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error(`Failed to copy ${label.toLowerCase()}`));

const Card: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; testId?: string }> = ({ title, icon: Icon, children, testId }) => (
  <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4" data-testid={testId}>
    <h3 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      {title}
    </h3>
    {children}
  </section>
);

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

const UserProfileDetails: React.FC<UserProfileDetailsProps> = ({ user, jobCategories, verification }) => {
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

  return (
    <div className="space-y-4" data-testid="user-profile-details">
      <Card title="About" icon={UserIcon} testId="user-about">
        {user.bio && (
          <p className="text-sm text-gray-700 italic bg-white border border-gray-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-line">“{user.bio}”</p>
        )}
        <Facts>
          <Fact label="Full name">{fullName}</Fact>
          <Fact label="Account type">{isProvider ? 'Service provider' : 'Customer'}</Fact>
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
      </Card>

      <Card title="Contact & location" icon={Phone} testId="user-contact">
        <Facts>
          <Fact label="Email" wide><span data-testid="user-contact-email"><CopyValue value={user.email} label="Email" /></span></Fact>
          <Fact label="Phone" empty={!phone}>{phone && <CopyValue value={phone} label="Phone number" />}</Fact>
          <Fact label="Location" empty={!user.location}>{user.location}</Fact>
          {addresses.length > 0 && (
            <Fact label="Saved addresses" sub={addresses.length > 1 ? `${addresses.length} saved` : undefined}>
              {defaultAddress?.name}{defaultAddress?.city ? ` · ${defaultAddress.city}` : ''}
            </Fact>
          )}
          {isProvider && user.serviceArea?.radius != null && (
            <Fact label="Service area">{user.serviceArea.radius} km{serviceCenter ? ` around ${serviceCenter}` : ''}</Fact>
          )}
        </Facts>
      </Card>

      {isProvider && (
        <Card title="Work profile" icon={Briefcase} testId="user-work-profile">
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
        </Card>
      )}

      <Card title="Money & fees" icon={Wallet} testId="user-money-summary">
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
      </Card>

      <Card title="Verification & standing" icon={ShieldCheck} testId="user-standing">
        <p className="text-sm mb-3">
          <span className="text-gray-500 text-xs">Identity: </span>
          <span className={`font-semibold ${user.isVerified ? 'text-green-700' : 'text-amber-600'}`}>{identityStatus}</span>
          {reviewedLine && <span className="text-[11px] text-gray-400"> · {reviewedLine}</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
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
        </div>
      </Card>
    </div>
  );
};

export default UserProfileDetails;
