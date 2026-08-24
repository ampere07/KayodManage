import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Zap,
  Percent,
  Ban,
  UserX,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useJobPostingSettings,
  useUpdateJobPostingSettings,
  JOB_POSTING_SETTINGS_KEY,
} from '../../hooks/useJobPostingSettings';
import { JobPostingSettings } from '../../types/configuration.types';
import { useSocket } from '../../context/SocketContext';

type FormState = Omit<JobPostingSettings, 'updatedAt' | 'updatedBy'>;

const normalize = (s: Partial<JobPostingSettings>): FormState => ({
  maxActiveJobsPerUser: s.maxActiveJobsPerUser ?? 5,
  jobPostDurationDays: s.jobPostDurationDays ?? 30,
  asapFee: s.asapFee ?? 100,
  bookingFeePercentage: s.bookingFeePercentage ?? 0,
  bookingFeeThreshold: s.bookingFeeThreshold ?? 0,
  bookingFeeMinimum: s.bookingFeeMinimum ?? 0,
  clientCancellationFeePercentage: s.clientCancellationFeePercentage ?? 10,
  clientCancellationFeeMinimum: s.clientCancellationFeeMinimum ?? 150,
  clientCancellationFeeThreshold: s.clientCancellationFeeThreshold ?? 0,
  clientCancellationDayOfFeePercentage: s.clientCancellationDayOfFeePercentage ?? 20,
  clientCancellationDayOfFeeMinimum: s.clientCancellationDayOfFeeMinimum ?? 300,
  providerStrikeLimit: s.providerStrikeLimit ?? 4,
  providerStrikeRatingPenalty: s.providerStrikeRatingPenalty ?? 0,
  noShowReviewWindowHours: s.noShowReviewWindowHours ?? 48,
  noShowReviewReminderHours: s.noShowReviewReminderHours ?? 24,
  noShowPayoutPercentage: s.noShowPayoutPercentage ?? 20,
  noShowPayoutMinimum: s.noShowPayoutMinimum ?? 300,
  noShowPayoutHoldHours: s.noShowPayoutHoldHours ?? 0,
  noShowLapseRestrictionCount: s.noShowLapseRestrictionCount ?? 3,
  confirmedFaultRestrictionCount: s.confirmedFaultRestrictionCount ?? 2,
  disputeLossRestrictionCount: s.disputeLossRestrictionCount ?? 3,
  requireApproval: s.requireApproval ?? false,
  allowAttachments: s.allowAttachments ?? true,
  maxAttachments: s.maxAttachments ?? 5,
});

const JobPostingConfiguration: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { settings, isLoading } = useJobPostingSettings();
  const updateMutation = useUpdateJobPostingSettings();

  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState<FormState | null>(null);

  const isDirty = useMemo(
    () => !!form && !!baseline && JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!settings) return;
    const server = normalize(settings);
    setForm((current) => (current === null || !isDirtyRef.current ? server : current));
    setBaseline(server);
  }, [settings]);

  useEffect(() => {
    if (!socket) return;
    const handleConfigurationUpdate = (data: any) => {
      if (data?.type === 'job-posting') {
        queryClient.invalidateQueries({ queryKey: [JOB_POSTING_SETTINGS_KEY] });
      }
    };
    socket.on('configuration:updated', handleConfigurationUpdate);
    return () => { socket.off('configuration:updated', handleConfigurationUpdate); };
  }, [socket, queryClient]);

  const validationError = useMemo(() => {
    if (!form) return null;
    if (form.bookingFeePercentage < 0 || form.bookingFeePercentage > 100) return 'Booking fee percentage must be between 0 and 100.';
    if (form.clientCancellationFeePercentage < 0 || form.clientCancellationFeePercentage > 100) return 'Client cancellation fee percentage must be between 0 and 100.';
    if (form.clientCancellationDayOfFeePercentage < 0 || form.clientCancellationDayOfFeePercentage > 100) return 'Day-of cancellation fee percentage must be between 0 and 100.';
    if (form.providerStrikeLimit < 1) return 'Provider strike limit must be at least 1.';
    if (form.noShowPayoutPercentage < 0 || form.noShowPayoutPercentage > 100) return 'No-show payout percentage must be between 0 and 100.';
    if (form.noShowReviewWindowHours < 1) return 'The no-show review window must be at least 1 hour.';
    // A reminder at or after the deadline never fires — the window resolves
    // first. Same rule the API enforces; catching it here means the admin sees
    // why rather than a rejected save.
    if (form.noShowReviewReminderHours >= form.noShowReviewWindowHours) return 'The reminder must fire before the review window closes, otherwise it never sends.';
    if (form.noShowLapseRestrictionCount < 1) return 'Missed bookings before restriction must be at least 1.';
    if (form.confirmedFaultRestrictionCount < 0) return 'Confirmed no-shows before restriction cannot be negative.';
    // 1 would restrict on a single good-faith complaint, which is the opposite
    // of what this protects against. 0 disables it.
    if (form.disputeLossRestrictionCount === 1) return 'Lost disputes before restriction must be 0 (disabled) or at least 2 — one lost dispute is not abuse.';
    return null;
  }, [form]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const handleSave = () => {
    if (!form || !isDirty || validationError) return;
    updateMutation.mutate(form);
  };

  const handleDiscard = () => {
    if (baseline) setForm(baseline);
  };

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const canSave = isDirty && !validationError && !updateMutation.isPending;

  return (
    <div className="h-full flex flex-col bg-white">

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 h-[65px] border-b border-gray-100">
        <div className="text-xs text-gray-400">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          ) : settings?.updatedAt ? (
            <span>
              Last updated {new Date(settings.updatedAt).toLocaleString()}
              {settings.updatedBy ? ` by ${settings.updatedBy}` : ''}
            </span>
          ) : (
            <span>Configure the rules applied to every new job post</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDiscard}
            disabled={!isDirty || updateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8">

          {validationError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-16 gap-y-10">

            {/* Booking Fee — left column, spans both rows on xl */}
            <div className="xl:row-span-2">
              <div className="flex items-center gap-2 mb-0.5">
                <Percent className="w-4 h-4 text-blue-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700">Booking Fee</h3>
              </div>
              <p className="text-xs text-gray-400 mb-5 pl-6">
                Platform fee based on a job's budget. A percentage applies at or above the threshold; smaller jobs pay a flat minimum.
              </p>
              <div className="divide-y divide-gray-100">
                <Row label="Booking fee percentage" desc="Percentage of the budget charged when the budget is at or above the threshold.">
                  <NumInput value={form.bookingFeePercentage} min={0} suffix="%" onChange={(v) => setField('bookingFeePercentage', v)} />
                </Row>
                <Row label="Percentage trigger (threshold)" desc="Budget at or above this amount is charged the percentage fee.">
                  <NumInput value={form.bookingFeeThreshold} min={0} prefix="₱" onChange={(v) => setField('bookingFeeThreshold', v)} />
                </Row>
                <Row label="Minimum booking fee" desc="Flat fee charged when a job's budget is below the threshold.">
                  <NumInput value={form.bookingFeeMinimum} min={0} prefix="₱" onChange={(v) => setField('bookingFeeMinimum', v)} />
                </Row>
              </div>
              <p className="text-xs text-gray-400 italic mt-3">
                {form.bookingFeePercentage === 0 && form.bookingFeeMinimum === 0
                  ? 'Booking fee is disabled. Set a percentage or minimum to start charging.'
                  : `Jobs ≥ ₱${form.bookingFeeThreshold.toLocaleString()} pay ${form.bookingFeePercentage}% · jobs below pay a flat ₱${form.bookingFeeMinimum.toLocaleString()}.`}
              </p>
            </div>

            {/* Priority Fees — right column top */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700">Priority Fees</h3>
              </div>
              <p className="text-xs text-gray-400 mb-5 pl-6">
                Fees charged to the client for priority job posts in the Kayod app.
              </p>
              <div className="divide-y divide-gray-100">
                <Row label="ASAP fee" desc="Fee a client pays when posting an ASAP (immediate) job. Charged from the client's wallet on posting.">
                  <NumInput value={form.asapFee} min={0} prefix="₱" onChange={(v) => setField('asapFee', v)} />
                </Row>
              </div>
            </div>

            {/* Cancellation — right column bottom */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Ban className="w-4 h-4 text-red-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700">Cancellation</h3>
              </div>
              <p className="text-xs text-gray-400 mb-5 pl-6">
                Two tiers, by when the client cancels: cancelling in advance frees a slot the
                provider can refill, cancelling on the day costs them the day. Plus the provider
                cancellation strike effect.
              </p>
              <div className="divide-y divide-gray-100">
                <Row label="Advance cancellation fee" desc="Percentage of the agreed price charged when a client cancels BEFORE the booking day.">
                  <NumInput value={form.clientCancellationFeePercentage} min={0} suffix="%" onChange={(v) => setField('clientCancellationFeePercentage', v)} />
                </Row>
                <Row label="Advance flat fee" desc="Charged INSTEAD of the percentage when the agreed price is at or below the trigger. Not a floor: above the trigger the percentage applies even if it works out smaller than this.">
                  <NumInput value={form.clientCancellationFeeMinimum} min={0} prefix="₱" onChange={(v) => setField('clientCancellationFeeMinimum', v)} />
                </Row>
                <Row label="Day-of cancellation fee" desc="Percentage charged when a client cancels ON or AFTER the booking day. ASAP bookings count as day-of from the moment they are booked.">
                  <NumInput value={form.clientCancellationDayOfFeePercentage} min={0} suffix="%" onChange={(v) => setField('clientCancellationDayOfFeePercentage', v)} />
                </Row>
                <Row label="Day-of flat fee" desc="Charged INSTEAD of the day-of percentage when the agreed price is at or below the trigger. Not a floor — see the advance flat fee.">
                  <NumInput value={form.clientCancellationDayOfFeeMinimum} min={0} prefix="₱" onChange={(v) => setField('clientCancellationDayOfFeeMinimum', v)} />
                </Row>
                <Row label="Percentage trigger (threshold)" desc="Agreed price above this amount pays the percentage; at or below it pays that tier's flat fee. 0 uses each tier's own flat fee as the trigger.">
                  <NumInput value={form.clientCancellationFeeThreshold} min={0} prefix="₱" onChange={(v) => setField('clientCancellationFeeThreshold', v)} />
                </Row>
                <Row label="Provider strike limit" desc="Cancellation strikes before a provider is restricted from accepting jobs.">
                  <NumInput value={form.providerStrikeLimit} min={1} onChange={(v) => setField('providerStrikeLimit', v)} />
                </Row>
                <Row label="Rating penalty per strike" desc="Rating points deducted each time a provider cancels. 0 keeps the default escalating penalties (0.3 / 0.5 / 0.7…).">
                  <NumInput value={form.providerStrikeRatingPenalty} min={0} step="any" onChange={(v) => setField('providerStrikeRatingPenalty', v)} />
                </Row>
              </div>
              <p className="text-xs text-gray-400 italic mt-3">
                Above the trigger the PERCENTAGE applies; at or below it, the flat fee.
                Before the day: {form.clientCancellationFeePercentage}% or ₱{form.clientCancellationFeeMinimum.toLocaleString()} flat ·
                on the day: {form.clientCancellationDayOfFeePercentage}% or ₱{form.clientCancellationDayOfFeeMinimum.toLocaleString()} flat.
                A ₱1,000 day-of cancellation therefore pays {form.clientCancellationDayOfFeePercentage}% — which can be
                LESS than the flat fee. That is deliberate; the flat fee is not a floor.
              </p>
            </div>

            {/* No-show review — full width, below both columns */}
            <div className="xl:col-span-2">
              <div className="flex items-center gap-2 mb-0.5">
                <UserX className="w-4 h-4 text-purple-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700">No-Show Review</h3>
              </div>
              <p className="text-xs text-gray-400 mb-5 pl-6">
                When a booking's day passes with neither side confirming, both parties are notified
                and both can raise an issue. If nobody does, the booking closes and the client is
                refunded in full — no fee, no payout, no strike. The payout below applies only when
                an admin reviews a raised issue and finds the client did not appear.
              </p>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-16">
                <div className="divide-y divide-gray-100">
                  <Row label="Review window" desc="Hours from the booking day ending until the booking closes and the client is refunded in full.">
                    <NumInput value={form.noShowReviewWindowHours} min={1} suffix="h" onChange={(v) => setField('noShowReviewWindowHours', v)} />
                  </Row>
                  <Row label="Reminder at" desc="Hours into the window when both parties get a single 'time is running out' reminder. Must be less than the window.">
                    <NumInput value={form.noShowReviewReminderHours} min={0} suffix="h" onChange={(v) => setField('noShowReviewReminderHours', v)} />
                  </Row>
                  <Row label="Missed bookings before restriction" desc="Unclaimed no-shows within 30 days before an account is restricted automatically. A single one never restricts anyone.">
                    <NumInput value={form.noShowLapseRestrictionCount} min={1} onChange={(v) => setField('noShowLapseRestrictionCount', v)} />
                  </Row>
                  <Row label="Lost disputes before restriction" desc="Disputes a party raised and did NOT win, within 30 days, before their account is restricted. Raising a dispute freezes a payout, so repeat losing claims are a denial-of-service. 0 disables; 1 is rejected because one lost dispute is not abuse.">
                    <NumInput value={form.disputeLossRestrictionCount} min={0} onChange={(v) => setField('disputeLossRestrictionCount', v)} />
                  </Row>
                  <Row label="Confirmed no-shows before restriction" desc="Findings where an admin established that this party failed to attend, within 30 days, before their account is restricted. Lower than the two above on purpose: a lapse means nobody spoke up and a lost dispute is not a finding of fault, but a finding IS the evidence. 0 disables auto-restriction while still recording every finding.">
                    <NumInput value={form.confirmedFaultRestrictionCount} min={0} onChange={(v) => setField('confirmedFaultRestrictionCount', v)} />
                  </Row>
                </div>
                <div className="divide-y divide-gray-100">
                  <Row label="Reserved-time payout" desc="Percentage of the held amount paid to the provider when an admin finds the client did not appear. The rest is refunded to the client.">
                    <NumInput value={form.noShowPayoutPercentage} min={0} suffix="%" onChange={(v) => setField('noShowPayoutPercentage', v)} />
                  </Row>
                  <Row label="Minimum payout (floor)" desc="A true FLOOR, unlike the cancellation flat fees above: the payout is never less than this, even when the percentage works out smaller. Capped at the held amount.">
                    <NumInput value={form.noShowPayoutMinimum} min={0} prefix="₱" onChange={(v) => setField('noShowPayoutMinimum', v)} />
                  </Row>
                  <Row label="Payout hold" desc="Hours the payout is held before reaching the provider's balance. 0 uses the job's own release window, so an instant-service job isn't paid out the moment you click.">
                    <NumInput value={form.noShowPayoutHoldHours} min={0} suffix="h" onChange={(v) => setField('noShowPayoutHoldHours', v)} />
                  </Row>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic mt-3">
                Nobody raises an issue within {form.noShowReviewWindowHours}h → client refunded in full.
                Issue raised and upheld → provider gets {form.noShowPayoutPercentage}% (min ₱{form.noShowPayoutMinimum.toLocaleString()}),
                held for {form.noShowPayoutHoldHours > 0 ? `${form.noShowPayoutHoldHours}h` : "the job's own release window"}.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// --- Helpers ------------------------------------------------------------------

const Row: React.FC<{ label: string; desc: string; children: React.ReactNode; disabled?: boolean }> = ({
  label, desc, children, disabled,
}) => (
  <div className={`flex items-center justify-between gap-8 py-4 ${disabled ? 'opacity-40' : ''}`}>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

interface NumInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number | 'any';
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}

const NumInput: React.FC<NumInputProps> = ({ value, onChange, min = 0, step, prefix, suffix, disabled }) => (
  <div className="relative flex items-center">
    {prefix && (
      <span className="absolute left-3 text-sm text-gray-400 pointer-events-none select-none">{prefix}</span>
    )}
    <input
      type="number"
      min={min}
      step={step}
      value={Number.isFinite(value) ? value : ''}
      disabled={disabled}
      onFocus={(e) => e.target.select()}
      onChange={(e) => { const n = e.target.valueAsNumber; onChange(Number.isNaN(n) ? 0 : n); }}
      className={`w-28 py-2 text-right text-sm font-medium rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
    />
    {suffix && (
      <span className="absolute right-3 text-xs text-gray-400 pointer-events-none select-none">{suffix}</span>
    )}
  </div>
);

export default JobPostingConfiguration;
