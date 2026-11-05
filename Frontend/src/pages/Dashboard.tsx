import { useMemo } from 'react';
import { format } from 'date-fns';
import { LayoutDashboard, RefreshCw, Briefcase, Receipt, Users, ClipboardList } from 'lucide-react';
import { useDashboardOverview } from '../hooks/useDashboard';
import KpiCard from '../components/Dashboard/KpiCard';
import EarningsCard from '../components/Dashboard/EarningsCard';
import AttentionCard from '../components/Dashboard/AttentionCard';
import JobsNowCard from '../components/Dashboard/JobsNowCard';
import TopServicesCard from '../components/Dashboard/TopServicesCard';
import TodayStrip from '../components/Dashboard/TodayStrip';
import { change, peso, sumOf } from '../components/Dashboard/dashboardFormat';
import type { DashboardOverview } from '../types/dashboard.types';

/**
 * The Dashboard answers two questions, in this order of space: how is the
 * marketplace doing (four 30-day numbers and an earnings chart), and what is
 * waiting on an admin (the queues, each a click from its page). Everything
 * comes from one request that refreshes every minute.
 *
 * On a laptop or desktop window (the `fit` variant) the page fills the window
 * exactly, with no scrollbar: the bottom row keeps its natural height and the
 * earnings chart takes whatever is left, while short windows (`compact`,
 * `tight`) drop secondary lines first. Below 1280px wide (tablets, phones)
 * or 600px tall the cards stack in one or two columns and the page scrolls:
 * three columns there would cut off the queue names.
 */

function Header({ updatedAt, refreshing, onRefresh }: { updatedAt: number; refreshing: boolean; onRefresh: () => void }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between gap-3">
      <div className="hidden md:block">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 bg-blue-50 rounded-lg">
            <LayoutDashboard className="h-5 w-5 text-blue-600" />
          </span>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard</h1>
        </div>
        <p className="text-xs text-gray-500 font-medium compact:hidden">How the marketplace is doing, and what's waiting on you</p>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {updatedAt > 0 && <span className="text-xs text-gray-500">Updated {format(updatedAt, 'h:mm a')}</span>}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

function KpiRow({ data }: { data: DashboardOverview }) {
  const cards = useMemo(() => {
    type Day = DashboardOverview['daily'][number];
    const current = data.daily.slice(-30);
    const previous = data.daily.slice(-60, -30);
    const total = (rows: Day[], pick: (d: Day) => number) => sumOf(rows, pick);
    // The small bars are whole weeks (the last 8, this week last): daily counts
    // this small jump between 0 and 1 and say nothing about direction.
    const lastEightWeeks = data.daily.slice(-56);
    const weekly = (pick: (d: Day) => number) =>
      Array.from({ length: 8 }, (_, w) => total(lastEightWeeks.slice(w * 7, w * 7 + 7), pick));
    const metric = (pick: (d: Day) => number) => ({
      sum: total(current, pick),
      change: change(total(current, pick), total(previous, pick)),
      weeks: weekly(pick),
    });
    const jobValue = metric((d) => d.jobValue);
    const fees = metric((d) => d.fees);
    const newUsers = metric((d) => d.newClients + d.newProviders);
    const posted = metric((d) => d.jobsPosted);
    return [
      {
        title: 'Job value', icon: Briefcase, tone: 'emerald' as const, to: '/jobs',
        value: peso(jobValue.sum), change: jobValue.change, weeks: jobValue.weeks,
        detail: `${total(current, (d) => d.jobsCompleted)} jobs completed`,
      },
      {
        title: 'Fees earned', icon: Receipt, tone: 'blue' as const, to: '/transactions/fee-records',
        value: peso(fees.sum), change: fees.change, weeks: fees.weeks,
        detail: `${total(current, (d) => d.feeCount)} platform fees collected`,
      },
      {
        title: 'New users', icon: Users, tone: 'purple' as const, to: '/users',
        value: newUsers.sum.toLocaleString(), change: newUsers.change, weeks: newUsers.weeks,
        detail: `${total(current, (d) => d.newClients)} customers · ${total(current, (d) => d.newProviders)} providers`,
      },
      {
        title: 'Jobs posted', icon: ClipboardList, tone: 'orange' as const, to: '/jobs',
        value: posted.sum.toLocaleString(), change: posted.change, weeks: posted.weeks,
        detail: `${data.jobs.open} open right now`,
      },
    ];
  }, [data]);

  return (
    <section className="flex-shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 mb-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last 30 days</span>
        <TodayStrip today={data.today} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4 compact:gap-3">
        {cards.map((card) => (
          <KpiCard key={card.title} {...card} comparedWith="previous 30 days" />
        ))}
      </div>
    </section>
  );
}

function Skeleton() {
  const block = 'bg-white rounded-2xl border border-gray-200 animate-pulse';
  return (
    <div className="flex flex-col gap-4 compact:gap-3 fit:flex-1 fit:min-h-0" aria-busy="true" aria-label="Loading the dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4 pt-6 flex-shrink-0">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${block} h-[120px] sm:h-[136px] compact:h-[112px]`} />)}
      </div>
      <div className="grid gap-4 compact:gap-3 md:grid-cols-2 xl:grid-cols-3 fit:flex-1 fit:min-h-0 fit:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] compact:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] tight:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${block} h-[320px] fit:h-auto md:col-span-2`} />
        <div className={`${block} h-[320px] fit:h-auto md:row-span-2`} />
        <div className={`${block} h-[240px] fit:h-auto`} />
        <div className={`${block} h-[240px] fit:h-auto`} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isError, isFetching, refetch, dataUpdatedAt } = useDashboardOverview();

  return (
    <div className="h-full overflow-y-auto fit:overflow-hidden bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 xl:px-8 tight:px-6 py-4 md:py-5 compact:py-4 tight:py-3 flex flex-col gap-4 md:gap-5 compact:gap-3 fit:h-full">
        <Header updatedAt={dataUpdatedAt} refreshing={isFetching} onRefresh={() => refetch()} />

        {!data && isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>The dashboard couldn't load its numbers.</span>
            <button type="button" onClick={() => refetch()} className="font-semibold underline">Try again</button>
          </div>
        ) : !data ? (
          <Skeleton />
        ) : (
          <>
            <KpiRow data={data} />

            {/* Three columns from 1280px: earnings across two with the queues
                beside it at full height, jobs and top services underneath.
                Fitting the window, the two rows split the height that is left
                (earnings a little more on shorter windows); the chart flexes and
                Most requested shows as many services as fit. Two columns below
                1280px: earnings on top, the queues beside jobs and services. */}
            <div className="grid gap-4 compact:gap-3 md:grid-cols-2 xl:grid-cols-3 fit:flex-1 fit:min-h-0 fit:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] compact:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] tight:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="md:col-span-2 min-h-[320px] fit:min-h-0">
                <EarningsCard daily={data.daily} monthly={data.monthly} />
              </div>
              <div className="md:row-span-2 fit:min-h-0">
                <AttentionCard attention={data.attention} />
              </div>
              <JobsNowCard jobs={data.jobs} />
              <TopServicesCard topServices={data.topServices} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
