import { Gift, Image as ImageIcon, Megaphone, Tag } from 'lucide-react';
import { format, isSameYear } from 'date-fns';
import type { Tone } from '../components/UI/CounterGroups';
import {
  AdPlacement,
  AdState,
  AdStatus,
  Advertisement,
  AdvertisementType,
} from '../types/configuration.types';

// One place for every user-facing word about an advertisement, so the list, the
// panel and the toasts describe the same thing the same way.

export const TYPE_META: Record<
  AdvertisementType,
  { label: string; hint: string; icon: React.ComponentType<{ className?: string }> }
> = {
  offer: { label: 'Discount promo', hint: 'Headline, discount and a button', icon: Tag },
  invite: { label: 'Referral invite', hint: 'Two-line message and a button', icon: Gift },
  image: { label: 'Custom image', hint: 'Your own banner artwork', icon: ImageIcon },
};

export const typeIconOf = (type: string) => TYPE_META[type as AdvertisementType]?.icon || Megaphone;
export const typeLabelOf = (type: string) => TYPE_META[type as AdvertisementType]?.label || type;

/** What each state means, and how it is drawn (badge, counter tone). */
export const STATE_META: Record<AdState, { label: string; help: string; badge: string; dot: string; tone: Tone }> = {
  live: {
    label: 'Live',
    help: 'Showing in the app right now',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    tone: 'emerald',
  },
  scheduled: {
    label: 'Scheduled',
    help: 'Published, and waiting for its start time',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    tone: 'blue',
  },
  paused: {
    label: 'Paused',
    help: 'Taken down — publish it to bring it back',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    tone: 'amber',
  },
  draft: {
    label: 'Draft',
    help: 'Never published — only admins can see it',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    tone: 'gray',
  },
  ended: {
    label: 'Ended',
    help: 'Its end time has passed — change the schedule to run it again',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    tone: 'violet',
  },
};

export const STATE_ORDER: AdState[] = ['live', 'scheduled', 'paused', 'draft', 'ended'];

export const PLACEMENT_META: Record<AdPlacement, { label: string; short: string; where: string; tone: Tone }> = {
  client_home: {
    label: 'Client home',
    short: 'Clients',
    where: 'The promo carousel under Popular Categories, ahead of the built-in invite and offer slides',
    tone: 'orange',
  },
  provider_home: {
    label: 'Provider home',
    short: 'Providers',
    where: 'A carousel under the job stats — providers only see it when an ad is aimed at them',
    tone: 'indigo',
  },
};

export const PLACEMENTS: AdPlacement[] = ['client_home', 'provider_home'];

/** Rows written before the lifecycle field existed only carry isActive. */
export const statusOf = (ad: Pick<Advertisement, 'status' | 'isActive'>): AdStatus =>
  ad.status || (ad.isActive ? 'published' : 'paused');

/** No placements (an ad from before they existed) means the client home. */
export const placementsOf = (ad: Pick<Advertisement, 'placements'>): AdPlacement[] =>
  ad.placements && ad.placements.length > 0 ? ad.placements : ['client_home'];

const toTime = (v?: string | Date | null) => {
  if (v == null || v === '') return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * The state at `now`, by the server's rule (Backend utils/advertisementRules
 * stateOf). The server sends `state` on the list; this recomputes it for a
 * draft being edited and for the preview, which can't wait for a round trip.
 */
export function stateOf(ad: Pick<Advertisement, 'status' | 'isActive' | 'startsAt' | 'endsAt'>, now = new Date()): AdState {
  const status = statusOf(ad);
  if (status === 'draft') return 'draft';
  if (status === 'paused') return 'paused';
  const at = now.getTime();
  const start = toTime(ad.startsAt);
  const end = toTime(ad.endsAt);
  if (end !== null && end <= at) return 'ended';
  if (start !== null && start > at) return 'scheduled';
  return 'live';
}

/** Whether the app shows it in `placement`'s carousel at `now`. */
export const isShowingIn = (ad: Advertisement, placement: AdPlacement, now = new Date()) =>
  stateOf(ad, now) === 'live' && placementsOf(ad).includes(placement);

/** A never-blank name for an ad, for headings and confirmation copy. */
export const adName = (ad: Pick<Advertisement, 'title' | 'type'>) =>
  ad.title?.trim() || `Untitled ${typeLabelOf(ad.type).toLowerCase()}`;

/** "Oct 25, 9:00 AM" (adds the year when it isn't this year's). */
export const when = (v: string | Date, now = new Date()) => {
  const d = new Date(v);
  return format(d, isSameYear(d, now) ? 'MMM d, h:mm a' : 'MMM d, yyyy, h:mm a');
};

/** The quiet line under a state badge. */
export function stateDetail(ad: Advertisement, now = new Date()): string {
  switch (stateOf(ad, now)) {
    case 'scheduled':
      return `Starts ${when(ad.startsAt as string, now)}`;
    case 'ended':
      return `Ended ${when(ad.endsAt as string, now)}`;
    case 'live':
      return ad.endsAt ? `Until ${when(ad.endsAt, now)}` : 'Until you pause it';
    case 'paused':
      return 'Hidden from the app';
    case 'draft':
    default:
      return 'Not published';
  }
}

/** "3.1%" — taps per view; a dash while there's nothing to divide. */
export const tapRate = (views: number, taps: number) =>
  views > 0 ? `${((taps / views) * 100).toFixed(taps / views >= 0.1 ? 0 : 1)}%` : '–';

export const count = (n: number) => n.toLocaleString();

/**
 * The next time the carousels change by themselves: the soonest start of a
 * scheduled ad, or end of a live one. null when nothing is scheduled to change.
 */
export function nextScheduledChange(ads: Advertisement[], now = new Date()): { ad: Advertisement; at: Date; kind: 'starts' | 'ends' } | null {
  let next: { ad: Advertisement; at: Date; kind: 'starts' | 'ends' } | null = null;
  for (const ad of ads) {
    const state = stateOf(ad, now);
    const candidate =
      state === 'scheduled' && ad.startsAt ? { at: new Date(ad.startsAt), kind: 'starts' as const }
        : state === 'live' && ad.endsAt ? { at: new Date(ad.endsAt), kind: 'ends' as const }
          : null;
    if (candidate && (!next || candidate.at < next.at)) next = { ad, ...candidate };
  }
  return next;
}
