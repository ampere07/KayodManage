import React, { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Calculator,
  CalendarClock,
  CalendarX,
  ClipboardList,
  Coins,
  Hourglass,
  ListChecks,
  Percent,
  Scale,
  ShieldAlert,
  Smartphone,
  UserMinus,
  UserX,
  Zap,
} from 'lucide-react';
import FormPanel, { Field, FormError, inputClass, primaryButton, secondaryButton } from '../../UI/FormPanel';
import PanelSection from '../../UI/PanelSection';
import { useUpdateJobPostingSettings } from '../../../hooks/useJobPostingSettings';
import {
  DEFAULTS,
  PREMIUM_DISCOUNT,
  STANDARD_PLATFORM_RATE,
  TOPIC_FIELDS,
  clientCancelFee,
  flatUpTo,
  noShowPayout,
  peso,
  pickTopic,
  platformFee,
  platformRate,
  plural,
  providerCancelFee,
  providerFeeIsOff,
  splitProviderFee,
  topicChanged,
  validateTopic,
  type Policy,
  type PolicyField,
  type TopicId,
} from './policy';

export const TOPIC_META: Record<TopicId, { title: string; description: string; icon: LucideIcon }> = {
  posting: { title: 'Posting a job', description: 'What a client can post, and what ASAP costs', icon: ClipboardList },
  platform: { title: 'Platform fee', description: "The platform's cut of each job's payout", icon: Percent },
  clientCancel: { title: 'Client cancels', description: 'What a client pays to cancel a booked job', icon: CalendarX },
  providerCancel: { title: 'Provider cancels', description: 'What a provider pays, and the strikes they get', icon: UserMinus },
  noShow: { title: 'No-shows', description: "When a booking's day passes and nobody confirms", icon: UserX },
};

/** A number box with an optional ₱ / % / h unit. An emptied box holds NaN until refilled. */
const AmountInput: React.FC<{
  name: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  max?: number;
}> = ({ name, value, onChange, prefix, suffix, step, max }) => (
  <div className="relative">
    {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">{prefix}</span>}
    <input
      type="number"
      inputMode="decimal"
      name={name}
      min={0}
      max={max}
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      className={`${inputClass} tabular-nums ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-9' : ''}`}
    />
    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{suffix}</span>}
  </div>
);

const Fields: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);

/** A quiet derived line under a section's fields. */
const Note: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <p className="mt-2 text-[11px] text-gray-600" data-testid={testId}>{children}</p>
);

const Rows: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100" data-testid={testId}>{children}</ul>
);

const Row: React.FC<{ label: React.ReactNode; sub?: React.ReactNode; value: React.ReactNode }> = ({ label, sub, value }) => (
  <li className="flex items-start justify-between gap-3 px-3 py-2">
    <span className="min-w-0">
      <span className="block text-sm text-gray-700">{label}</span>
      {sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
    </span>
    <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{value}</span>
  </li>
);

const JobPostingTopicPanel: React.FC<{
  topic: TopicId | null;
  saved: Policy;
  onClose: () => void;
}> = ({ topic, saved, onClose }) => {
  const mutation = useUpdateJobPostingSettings();
  const [draft, setDraft] = useState<Policy>(saved);
  const [price, setPrice] = useState(1000);

  // A fresh copy of what's saved each time a panel opens; edits stay local until Save.
  useEffect(() => {
    if (!topic) return;
    setDraft(saved);
    setPrice(1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const error = useMemo(() => (topic ? validateTopic(topic, draft) : null), [topic, draft]);
  if (!topic) return null;

  const meta = TOPIC_META[topic];
  const changed = topicChanged(topic, draft, saved);
  const atDefaults = !topicChanged(topic, draft, DEFAULTS);
  const set = (key: PolicyField) => (v: number) => setDraft((d) => ({ ...d, [key]: v }));
  const amount = (key: PolicyField, unit: { prefix?: string; suffix?: string; step?: string; max?: number } = {}) => (
    <AmountInput name={key} value={draft[key]} onChange={set(key)} {...unit} />
  );
  const examplePrice = Number.isFinite(price) && price > 0 ? price : 0;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed || error || mutation.isPending) return;
    mutation.mutate(pickTopic(topic, draft), { onSuccess: onClose });
  };

  const priceBox = (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-medium text-gray-500">Booking price</span>
      <div className="w-36">
        <AmountInput name="examplePrice" value={price} onChange={setPrice} prefix="₱" />
      </div>
    </div>
  );

  const example = (children: React.ReactNode) => (
    <PanelSection icon={Calculator} label="Example" description="Worked out with the values above" testId="jp-example" last>
      {priceBox}
      <Rows testId="jp-example-rows">{children}</Rows>
    </PanelSection>
  );

  const tierSections = (prefix: 'client' | 'provider') => {
    const k = prefix === 'client'
      ? { pct: 'clientCancellationFeePercentage', flat: 'clientCancellationFeeMinimum', dayPct: 'clientCancellationDayOfFeePercentage', dayFlat: 'clientCancellationDayOfFeeMinimum', threshold: 'clientCancellationFeeThreshold' } as const
      : { pct: 'providerCancellationFeePercentage', flat: 'providerCancellationFeeMinimum', dayPct: 'providerCancellationDayOfFeePercentage', dayFlat: 'providerCancellationDayOfFeeMinimum', threshold: 'providerCancellationFeeThreshold' } as const;
    return (
      <>
        <PanelSection icon={CalendarClock} label="Before the booking day" description="The provider can still fill the slot" testId="jp-advance">
          <Fields>
            <Field label="Percentage of the booking">{amount(k.pct, { suffix: '%' })}</Field>
            <Field label="Flat fee" hint={`Charged instead, on bookings up to ${peso(flatUpTo(draft[k.flat], draft[k.threshold]))}`}>{amount(k.flat, { prefix: '₱' })}</Field>
          </Fields>
        </PanelSection>
        <PanelSection icon={CalendarX} label="On the booking day" description="The day is lost — ASAP bookings count from the moment they're booked" testId="jp-day-of">
          <Fields>
            <Field label="Percentage of the booking">{amount(k.dayPct, { suffix: '%' })}</Field>
            <Field label="Flat fee" hint={`Charged instead, on bookings up to ${peso(flatUpTo(draft[k.dayFlat], draft[k.threshold]))}`}>{amount(k.dayFlat, { prefix: '₱' })}</Field>
          </Fields>
        </PanelSection>
        <PanelSection icon={Coins} label="Flat fee limit" description="Which bookings pay the flat fee instead of the percentage" testId="jp-threshold">
          <Fields>
            <Field label="Flat fee on bookings up to" hint="0 uses each flat fee as its own limit">{amount(k.threshold, { prefix: '₱' })}</Field>
          </Fields>
          <Note>Above the limit the percentage applies, even when it comes to less than the flat fee — the flat fee is not a minimum.</Note>
        </PanelSection>
      </>
    );
  };

  let body: React.ReactNode = null;
  switch (topic) {
    case 'posting':
      body = (
        <>
          <PanelSection icon={ListChecks} label="Limits" description="How much one client can have going at once" testId="jp-limits">
            <Fields>
              <Field label="Active jobs per client" hint="Open or in progress">{amount('maxActiveJobsPerUser', { step: '1' })}</Field>
              <Field label="Photos & videos per post" hint="Counted together, 1 to 10">{amount('maxAttachments', { step: '1', max: 10 })}</Field>
            </Fields>
            <Note>Checked whenever a job goes live — posting, publishing a draft, reposting or extending.</Note>
          </PanelSection>
          <PanelSection icon={Zap} label="ASAP fee" description="What a right-now post costs the client" testId="jp-asap">
            <Fields>
              <Field label="ASAP fee" hint="0 makes ASAP posts free">{amount('asapFee', { prefix: '₱' })}</Field>
            </Fields>
            <Note>Taken from the client's wallet when they post. A client with less than this in their wallet can't post ASAP.</Note>
          </PanelSection>
          <PanelSection icon={Smartphone} label="In the app" description="What clients see" testId="jp-in-app" last>
            <Rows>
              <Row
                label="Posting an ASAP job"
                sub={draft.asapFee > 0 ? `“Includes a ${peso(draft.asapFee)} priority fee, charged when you post.”` : 'No fee is shown or charged.'}
                value={draft.asapFee > 0 ? peso(draft.asapFee) : 'Free'}
              />
              <Row
                label="At the limit"
                sub={`“You can have up to ${plural(draft.maxActiveJobsPerUser, 'active job')} at a time. Complete or cancel one before posting another.”`}
                value={plural(draft.maxActiveJobsPerUser, 'job')}
              />
              <Row
                label="Adding photos and videos"
                sub={`The picker stops at ${draft.maxAttachments}; a post with more is refused.`}
                value={`${draft.maxAttachments} max`}
              />
            </Rows>
          </PanelSection>
        </>
      );
      break;

    case 'platform': {
      const fee = platformFee(examplePrice, draft);
      const premiumFee = platformFee(examplePrice, draft, true);
      const flat = draft.bookingFeeThreshold > 0 && examplePrice < draft.bookingFeeThreshold;
      body = (
        <>
          <PanelSection icon={Percent} label="Rate" description="What the platform keeps from each job" testId="jp-rate">
            <Fields>
              <Field label="Percentage of the job" hint={`0 uses the standard ${STANDARD_PLATFORM_RATE}%`}>{amount('bookingFeePercentage', { suffix: '%', step: 'any' })}</Field>
            </Fields>
            <Note testId="jp-rate-note">
              Premium providers pay {PREMIUM_DISCOUNT} points less ({platformRate(draft, true)}%). Taken when the job's payment is released to the provider.
            </Note>
          </PanelSection>
          <PanelSection icon={Coins} label="Cheaper jobs" description="An optional flat fee instead, below a price" testId="jp-cheaper">
            <Fields>
              <Field label="Flat fee for jobs under" hint="0 = no flat fee; every job pays the percentage">{amount('bookingFeeThreshold', { prefix: '₱' })}</Field>
              <Field label="Flat fee" hint={draft.bookingFeeThreshold > 0 ? "Never more than the job's price" : 'Not used while the price above is 0'}>{amount('bookingFeeMinimum', { prefix: '₱' })}</Field>
            </Fields>
          </PanelSection>
          {example(
            <>
              <Row label="Platform fee" sub={flat ? `Flat fee — under ${peso(draft.bookingFeeThreshold)}` : `${platformRate(draft)}% of ${peso(examplePrice)}`} value={peso(fee)} />
              <Row label="Provider receives" value={peso(examplePrice - fee)} />
              <Row label="Premium provider receives" sub={flat ? 'Flat fee, same for everyone' : `${platformRate(draft, true)}%`} value={peso(examplePrice - premiumFee)} />
            </>
          )}
        </>
      );
      break;
    }

    case 'clientCancel': {
      const before = clientCancelFee(examplePrice, draft, false);
      const dayOf = clientCancelFee(examplePrice, draft, true);
      body = (
        <>
          {tierSections('client')}
          {example(
            <>
              <Row label="Cancelled before the day" sub={`Client gets ${peso(examplePrice - before)} back`} value={peso(before)} />
              <Row label="Cancelled on the day" sub={`Client gets ${peso(examplePrice - dayOf)} back`} value={peso(dayOf)} />
              <Row label="Who gets the fee" sub="For the slot they held" value="The provider" />
            </>
          )}
        </>
      );
      break;
    }

    case 'providerCancel': {
      const before = providerCancelFee(examplePrice, draft, false);
      const dayOf = providerCancelFee(examplePrice, draft, true);
      const share = (fee: number) => {
        const s = splitProviderFee(fee, draft);
        return `Client gets ${peso(s.client)} · platform ${peso(s.platform)}`;
      };
      body = (
        <>
          {tierSections('provider')}
          <PanelSection icon={ArrowLeftRight} label="Who gets it" description="Split between the client and the platform" testId="jp-split">
            <Fields>
              <Field label="Client's share" hint={`The platform keeps ${Number.isFinite(draft.providerCancellationFeeClientSharePercentage) ? Math.max(0, 100 - draft.providerCancellationFeeClientSharePercentage) : '–'}%`}>
                {amount('providerCancellationFeeClientSharePercentage', { suffix: '%', max: 100 })}
              </Field>
            </Fields>
            <Note>
              Taken from the provider's wallet; the client's share comes out of what it covers. The rest becomes an unpaid fee —
              a 3-day warning, then no new bookings until it's paid.
            </Note>
          </PanelSection>
          <PanelSection icon={ShieldAlert} label="Strikes" description="Every provider cancellation adds one, fee or not" testId="jp-strikes">
            <Fields>
              <Field label="Restricted at (strikes)" hint="They can't accept jobs from this strike on">{amount('providerStrikeLimit', { step: '1' })}</Field>
              <Field label="Rating penalty per strike" hint="0 = −0.3★, −0.5★, −0.7★, then −0.5★">{amount('providerStrikeRatingPenalty', { suffix: '★', step: '0.1' })}</Field>
            </Fields>
          </PanelSection>
          {example(
            providerFeeIsOff(draft) ? (
              <Row label="Any cancellation" sub="Only the strike and rating penalty apply" value="No fee" />
            ) : (
              <>
                <Row label="Cancelled before the day" sub={share(before)} value={peso(before)} />
                <Row label="Cancelled on the day" sub={share(dayOf)} value={peso(dayOf)} />
              </>
            )
          )}
        </>
      );
      break;
    }

    case 'noShow': {
      const payout = noShowPayout(examplePrice, draft);
      body = (
        <>
          <PanelSection icon={Hourglass} label="Review window" description="Starts when the booking day ends" testId="jp-window">
            <Fields>
              <Field label="Window" hint="Both sides can raise an issue">{amount('noShowReviewWindowHours', { suffix: 'h' })}</Field>
              <Field label="Reminder at" hint="One “time is running out” notice">{amount('noShowReviewReminderHours', { suffix: 'h' })}</Field>
            </Fields>
            <Note>If nobody raises an issue in time, the booking closes and the client is refunded in full — no fee, no payout, no strike.</Note>
          </PanelSection>
          <PanelSection icon={Scale} label="If an issue is upheld" description="An admin finds the client didn't appear" testId="jp-upheld">
            <Fields>
              <Field label="Provider gets" hint="Of the booking; the rest is refunded">{amount('noShowPayoutPercentage', { suffix: '%' })}</Field>
              <Field label="At least" hint="A true minimum, up to the booking">{amount('noShowPayoutMinimum', { prefix: '₱' })}</Field>
              <Field label="Held for" hint="0 = the job's own payment release window">{amount('noShowPayoutHoldHours', { suffix: 'h' })}</Field>
            </Fields>
          </PanelSection>
          <PanelSection icon={ShieldAlert} label="Automatic restriction" description="Counted over any 30 days" testId="jp-restriction">
            <Fields>
              <Field label="Missed bookings" hint="Nobody spoke up. At least 1">{amount('noShowLapseRestrictionCount', { step: '1' })}</Field>
              <Field label="Confirmed no-shows" hint="Found at fault. 0 = off">{amount('confirmedFaultRestrictionCount', { step: '1' })}</Field>
              <Field label="Lost disputes" hint="Raised and not won. 0 = off, never 1">{amount('disputeLossRestrictionCount', { step: '1' })}</Field>
            </Fields>
          </PanelSection>
          {example(
            <>
              <Row label="Nobody raises an issue" sub="No fee, no payout, no strike" value={`${peso(examplePrice)} back to client`} />
              <Row
                label="Issue upheld"
                sub={`Client gets ${peso(examplePrice - payout)} back · paid ${draft.noShowPayoutHoldHours > 0 ? `after ${plural(draft.noShowPayoutHoldHours, 'hour')}` : "on the job's release window"}`}
                value={`${peso(payout)} to provider`}
              />
            </>
          )}
        </>
      );
      break;
    }
  }

  const Icon = meta.icon;
  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-11 w-11 rounded-xl bg-blue-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-blue-600" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Job posting</p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight" data-testid="jp-panel-title">{meta.title}</h2>
        <p className="text-[11px] text-gray-500 truncate">{meta.description}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className="h-9 px-2 text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => setDraft((d) => ({ ...d, ...pickTopic(topic, DEFAULTS) }))}
        disabled={atDefaults || mutation.isPending}
        title={`Fill in the defaults for these ${TOPIC_FIELDS[topic].length} settings; nothing is saved until you press Save`}
        data-testid="jp-defaults"
      >
        Use defaults
      </button>
      <div className="flex items-center gap-2">
        <button type="button" className={secondaryButton} onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={!changed || Boolean(error) || mutation.isPending} data-testid="jp-save">
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  return (
    <FormPanel open onClose={onClose} onSubmit={save} testId="jp-panel" header={header} footer={footer}>
      <FormError message={error} testId="jp-error" />
      {body}
    </FormPanel>
  );
};

export default JobPostingTopicPanel;
