// GET /api/dashboard/overview. Days and months are counted in the
// marketplace's time zone (`timezone`), oldest first, ending today.

export interface DashboardDay {
  date: string; // YYYY-MM-DD
  fees: number;
  feeCount: number;
  jobValue: number;
  jobsCompleted: number;
  jobsPosted: number;
  newClients: number;
  newProviders: number;
}

export interface DashboardMonth {
  month: string; // YYYY-MM
  fees: number;
  feeCount: number;
  jobValue: number;
  jobsCompleted: number;
}

export interface WaitingQueue {
  count: number;
  oldestAt: string | null;
}

export type AttentionKey = 'disputes' | 'refunds' | 'reports' | 'verifications' | 'support' | 'cashouts';

export type ServicePeriod = '7d' | '30d' | '90d';

/** Jobs posted per service over `days` days, and over the same span before. */
export interface ServiceDemand {
  days: number;
  posted: number;
  previousPosted: number;
  /** The top 5 by jobs posted. */
  items: { name: string; count: number; previous: number }[];
}

export interface DashboardOverview {
  generatedAt: string;
  timezone: string;
  /** The last 60 days, so 30 days can be compared with the 30 before. */
  daily: DashboardDay[];
  /** The last 24 months, so 12 months can be compared with the 12 before. */
  monthly: DashboardMonth[];
  attention: Record<AttentionKey, WaitingQueue>;
  jobs: { open: number; scheduled: number; inProgress: number; completed30: number; cancelled30: number };
  topServices: Record<ServicePeriod, ServiceDemand>;
  today: { newClients: number; newProviders: number; jobsPosted: number; jobsCompleted: number; online: number };
}
