import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Info, Pencil, type LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  useJobPostingSettings,
  JOB_POSTING_SETTINGS_KEY,
} from '../../hooks/useJobPostingSettings';
import { useSocket } from '../../context/SocketContext';
import JobPostingTopicPanel, { TOPIC_META } from './jobPosting/JobPostingTopicPanel';
import {
  STANDARD_PLATFORM_RATE,
  TOPIC_ORDER,
  clientCancelFee,
  flatUpTo,
  hours,
  noShowPayout,
  normalize,
  peso,
  platformFee,
  platformRate,
  plural,
  providerCancelFee,
  providerFeeIsOff,
  ratingPenaltyText,
  restrictionCounts,
  type Policy,
  type TopicId,
} from './jobPosting/policy';

/**
 * Settings → Configuration → Job Posting.
 *
 * The rules the Kayod app applies to every job, read like a policy: one card
 * per topic, in the order a job lives through them (posted → paid out →
 * cancelled → missed), each stating its current rules in plain words with a
 * worked ₱1,000 example. Editing happens one topic at a time in a side panel
 * (jobPosting/JobPostingTopicPanel), which saves only that topic's settings.
 */

const EXAMPLE = 1000;

const Fact: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; testId?: string }> = ({ label, value, sub, testId }) => (
  <div className="min-w-0" data-testid={testId}>
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className="text-sm font-semibold text-gray-900 mt-0.5 break-words">{value}</dd>
    {sub && <dd className="text-[11px] text-gray-500">{sub}</dd>}
  </div>
);

const PolicyCard: React.FC<{
  topic: TopicId;
  onEdit: (topic: TopicId) => void;
  example: React.ReactNode;
  /** Calculator for a worked example; Info for a plain consequence. */
  exampleIcon?: LucideIcon;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ topic, onEdit, example, exampleIcon: ExampleIcon = Calculator, wide, children }) => {
  const { title, description, icon: Icon } = TOPIC_META[topic];
  return (
    <section
      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${wide ? 'xl:col-span-2' : ''}`}
      data-testid={`jp-card-${topic}`}
    >
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-gray-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{title}</h3>
          <p className="text-[11px] text-gray-500 leading-snug">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(topic)}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex-shrink-0"
          aria-label={`Edit ${title.toLowerCase()}`}
          data-testid={`jp-edit-${topic}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </header>
      <dl className={`px-4 py-4 grid grid-cols-2 gap-x-4 gap-y-3 ${wide ? 'lg:grid-cols-4' : ''}`}>{children}</dl>
      <p className="mt-auto flex items-start gap-2 px-4 py-2.5 border-t border-gray-100 text-xs text-gray-600" data-testid={`jp-example-${topic}`}>
        <ExampleIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-px" />
        <span>{example}</span>
      </p>
    </section>
  );
};

/** "10%" / "₱150 flat on bookings up to ₱150" for one cancellation tier. */
const tierSub = (flat: number, threshold: number, extra?: string) =>
  `${peso(flat)} flat on bookings up to ${peso(flatUpTo(flat, threshold))}${extra ? ` · ${extra}` : ''}`;

const JobPostingConfiguration: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { settings, isLoading } = useJobPostingSettings();
  const [editing, setEditing] = useState<TopicId | null>(null);
  const policy: Policy = useMemo(() => normalize(settings), [settings]);

  // Another admin's save refreshes this page too.
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

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const p = policy;
  // 'unknown' is what every save recorded before the session field was fixed — not a name.
  const by = settings.updatedBy && settings.updatedBy !== 'unknown' ? settings.updatedBy : null;
  const platform = platformFee(EXAMPLE, p);
  const providerOff = providerFeeIsOff(p);
  const restrictions = restrictionCounts(p);

  const cards: Record<TopicId, React.ReactNode> = {
    posting: (
      <PolicyCard
        topic="posting"
        onEdit={setEditing}
        exampleIcon={Info}
        example={`A client with ${plural(p.maxActiveJobsPerUser, 'active job')} can't post another until one is completed or cancelled.`}
      >
        <Fact label="Active jobs per client" value={p.maxActiveJobsPerUser} sub="Open or in progress" testId="jp-fact-active" />
        <Fact label="Photos & videos per post" value={p.maxAttachments} sub="Counted together" testId="jp-fact-media" />
        <Fact
          label="ASAP post"
          value={p.asapFee > 0 ? peso(p.asapFee) : 'Free'}
          sub={p.asapFee > 0 ? "From the client's wallet, when posting" : 'No priority fee'}
          testId="jp-fact-asap"
        />
      </PolicyCard>
    ),
    platform: (
      <PolicyCard
        topic="platform"
        onEdit={setEditing}
        example={`On a ${peso(EXAMPLE)} job the platform keeps ${peso(platform)} and the provider receives ${peso(EXAMPLE - platform)}.`}
      >
        <Fact
          label="Rate"
          value={`${platformRate(p)}%`}
          sub={p.bookingFeePercentage > 0 ? `Premium providers ${platformRate(p, true)}%` : `The standard ${STANDARD_PLATFORM_RATE}% · Premium ${platformRate(p, true)}%`}
          testId="jp-fact-rate"
        />
        <Fact
          label="Cheaper jobs"
          value={p.bookingFeeThreshold > 0 ? `${peso(p.bookingFeeMinimum)} flat` : 'Same rate'}
          sub={p.bookingFeeThreshold > 0 ? `Under ${peso(p.bookingFeeThreshold)}` : 'No flat fee set'}
          testId="jp-fact-cheaper"
        />
        <Fact label="Taken" value="At payout" sub="From the provider's earnings" />
      </PolicyCard>
    ),
    clientCancel: (
      <PolicyCard
        topic="clientCancel"
        onEdit={setEditing}
        example={`A ${peso(EXAMPLE)} booking costs ${peso(clientCancelFee(EXAMPLE, p, false))} to cancel before the day, ${peso(clientCancelFee(EXAMPLE, p, true))} on the day.`}
      >
        <Fact
          label="Before the booking day"
          value={`${p.clientCancellationFeePercentage}%`}
          sub={tierSub(p.clientCancellationFeeMinimum, p.clientCancellationFeeThreshold)}
          testId="jp-fact-client-advance"
        />
        <Fact
          label="On the booking day"
          value={`${p.clientCancellationDayOfFeePercentage}%`}
          sub={tierSub(p.clientCancellationDayOfFeeMinimum, p.clientCancellationFeeThreshold, 'ASAP counts')}
          testId="jp-fact-client-day-of"
        />
        <Fact label="Fee goes to" value="The provider" sub="The rest is refunded to the client" />
      </PolicyCard>
    ),
    providerCancel: (
      <PolicyCard
        topic="providerCancel"
        onEdit={setEditing}
        example={
          providerOff
            ? 'Provider cancellations cost nothing — only the strike and rating penalty apply.'
            : `A ${peso(EXAMPLE)} booking costs the provider ${peso(providerCancelFee(EXAMPLE, p, false))} before the day, ${peso(providerCancelFee(EXAMPLE, p, true))} on the day; ${p.providerCancellationFeeClientSharePercentage === 50 ? 'half' : `${p.providerCancellationFeeClientSharePercentage}%`} goes to the client.`
        }
      >
        {providerOff ? (
          <Fact label="Cancellation fee" value="None" sub="All four amounts are 0" testId="jp-fact-provider-advance" />
        ) : (
          <>
            <Fact
              label="Before the booking day"
              value={`${p.providerCancellationFeePercentage}%`}
              sub={tierSub(p.providerCancellationFeeMinimum, p.providerCancellationFeeThreshold)}
              testId="jp-fact-provider-advance"
            />
            <Fact
              label="On the booking day"
              value={`${p.providerCancellationDayOfFeePercentage}%`}
              sub={tierSub(p.providerCancellationDayOfFeeMinimum, p.providerCancellationFeeThreshold, 'ASAP counts')}
              testId="jp-fact-provider-day-of"
            />
            <Fact
              label="Fee goes to"
              value={`Client ${p.providerCancellationFeeClientSharePercentage}%`}
              sub={`Platform ${Math.max(0, 100 - p.providerCancellationFeeClientSharePercentage)}% · unpaid part is owed`}
              testId="jp-fact-provider-split"
            />
          </>
        )}
        <Fact
          label="Strikes"
          value={`Restricted at ${p.providerStrikeLimit}`}
          sub={ratingPenaltyText(p)}
          testId="jp-fact-strikes"
        />
      </PolicyCard>
    ),
    noShow: (
      <PolicyCard
        topic="noShow"
        wide
        onEdit={setEditing}
        example={`A ${peso(EXAMPLE)} booking nobody speaks up about is refunded in full; if an issue is upheld, the provider gets ${peso(noShowPayout(EXAMPLE, p))} and the client ${peso(EXAMPLE - noShowPayout(EXAMPLE, p))}.`}
      >
        <Fact
          label="Review window"
          value={hours(p.noShowReviewWindowHours)}
          sub={`After the booking day · reminder at ${p.noShowReviewReminderHours}h`}
          testId="jp-fact-window"
        />
        <Fact label="If nobody speaks up" value="Full refund" sub="No fee, no payout, no strike" />
        <Fact
          label="If an issue is upheld"
          value={`Provider gets ${p.noShowPayoutPercentage}%`}
          sub={`At least ${peso(p.noShowPayoutMinimum)} · ${p.noShowPayoutHoldHours > 0 ? `held ${hours(p.noShowPayoutHoldHours)}` : "on the job's release window"}`}
          testId="jp-fact-upheld"
        />
        <Fact
          label="Restricted after (30 days)"
          value={restrictions.missed}
          sub={`${restrictions.confirmed} · ${restrictions.disputes}`}
          testId="jp-fact-restriction"
        />
      </PolicyCard>
    ),
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-gray-500 font-medium" data-testid="jp-summary">
          What every job in the Kayod app runs on. Saved changes reach the app straight away.
        </p>
        <p className="text-xs text-gray-400" data-testid="jp-updated">
          {settings.updatedAt
            ? `Last changed ${format(new Date(settings.updatedAt), 'MMM d, yyyy h:mm a')}${by ? ` by ${by}` : ''}`
            : 'Not changed yet — these are the defaults'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 md:p-6 grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4" data-testid="jp-cards">
          {TOPIC_ORDER.map((topic) => <React.Fragment key={topic}>{cards[topic]}</React.Fragment>)}
        </div>
      </div>

      <JobPostingTopicPanel topic={editing} saved={policy} onClose={() => setEditing(null)} />
    </div>
  );
};

export default JobPostingConfiguration;
