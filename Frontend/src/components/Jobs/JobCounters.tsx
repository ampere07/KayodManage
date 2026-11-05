import React from 'react';
import type { JobsQuickFilter, JobsSummary } from '../../types/jobs.types';
import { peso } from './jobListHelpers';
import { pesoShort } from '../Dashboard/dashboardFormat';
import CounterGroups from '../UI/CounterGroups';
import type { Counter, CounterGroup, Tone } from '../UI/CounterGroups';

/**
 * The Jobs page's counters, which are also its filters. Statuses are grouped
 * by where a job is in its life (still going, or finished), then the two
 * quick filters for jobs that need an admin. Each number is the rows that
 * clicking it shows; clicking the selected one again shows every job.
 */
const JobCounters: React.FC<{
  summary?: JobsSummary;
  status: string;
  flag: JobsQuickFilter | null;
  onStatus: (status: string) => void;
  onFlag: (flag: JobsQuickFilter) => void;
  filtered: boolean;
  onClear: () => void;
}> = ({ summary, status, flag, onStatus, onFlag, filtered, onClear }) => {
  const by = summary?.byStatus;
  const statusCounter = (key: keyof JobsSummary['byStatus'], label: string, tone: Tone, hint: string, extra?: Counter['extra']): Counter => ({
    key, label, tone, hint, extra,
    count: by?.[key],
    selected: status === key && !flag,
    onClick: () => onStatus(key),
  });

  const groups: CounterGroup[] = [
    {
      label: 'Active',
      total: by && by.open + by.scheduled + by.in_progress,
      cells: [
        statusCounter('open', 'Open', 'blue', 'Posted, waiting for a provider to be booked'),
        statusCounter('scheduled', 'Scheduled', 'violet', 'A provider is booked for a date'),
        statusCounter('in_progress', 'In progress', 'amber', 'Work is under way'),
      ],
    },
    {
      label: 'Finished',
      total: by && by.completed + by.cancelled + by.expired,
      cells: [
        statusCounter('completed', 'Completed', 'emerald', 'Done; the figure beside it is what the completed jobs were worth', summary ? { full: peso(summary.totalValue), short: pesoShort(summary.totalValue) } : undefined),
        statusCounter('cancelled', 'Cancelled', 'red', 'Called off by the client, the provider or an admin'),
        statusCounter('expired', 'Expired', 'gray', 'Nobody was booked before the date passed'),
      ],
    },
    {
      label: 'Needs a look',
      cells: [
        {
          key: 'dispute', label: 'Disputes', tone: 'red', alert: true,
          hint: 'Bookings where the client or provider raised a dispute that is still open',
          count: summary?.disputes, selected: flag === 'dispute', onClick: () => onFlag('dispute'),
        },
        {
          key: 'no_quotes', label: 'No quotes yet', shortLabel: 'No quotes', tone: 'amber', alert: true,
          hint: 'Open jobs no provider has quoted on',
          count: summary?.openWithoutQuotes, selected: flag === 'no_quotes', onClick: () => onFlag('no_quotes'),
        },
      ],
    },
  ];
  return (
    <CounterGroups
      groups={groups}
      gridClass="grid-cols-[0.8fr_3fr_3fr_2.3fr]"
      all={{ count: summary?.total, selected: status === 'all' && !flag, onClick: () => onStatus('all') }}
      filtered={filtered}
      onClear={onClear}
      testId="jobs-counters"
      allCell={{ label: 'All', hint: 'Every job on the platform, apart from archived ones' }}
    />
  );
};

export default JobCounters;
