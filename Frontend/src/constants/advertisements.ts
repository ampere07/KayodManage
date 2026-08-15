import { Gift, Image as ImageIcon, Megaphone, Tag } from 'lucide-react';
import { AdStatus, Advertisement, AdvertisementType } from '../types/configuration.types';

// One place for every user-facing word about an advertisement, so the list, the
// form and the toasts all describe the same thing the same way.

export const STATUS_META: Record<
  AdStatus,
  { label: string; help: string; chip: string; dot: string }
> = {
  published: {
    label: 'Live',
    help: 'Showing in the app right now',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  paused: {
    label: 'Paused',
    help: 'Hidden from the app — publish it to bring it back',
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  draft: {
    label: 'Draft',
    help: 'Not published yet — only admins can see it',
    chip: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/20',
    dot: 'bg-gray-400',
  },
};

export const TYPE_META: Record<
  AdvertisementType,
  { label: string; hint: string; icon: React.ComponentType<{ className?: string }> }
> = {
  offer: {
    label: 'Discount promo',
    hint: 'Headline, discount and a button',
    icon: Tag,
  },
  invite: {
    label: 'Referral invite',
    hint: 'Two-line message and a button',
    icon: Gift,
  },
  image: {
    label: 'Custom image',
    hint: 'Your own banner artwork',
    icon: ImageIcon,
  },
};

export const typeIconOf = (type: string) => TYPE_META[type as AdvertisementType]?.icon || Megaphone;

export const typeLabelOf = (type: string) => TYPE_META[type as AdvertisementType]?.label || type;

/**
 * Rows written before the lifecycle field existed only carry isActive — the
 * backend backfills on read, this keeps the UI safe either way.
 */
export const statusOf = (ad: Pick<Advertisement, 'status' | 'isActive'>): AdStatus =>
  ad.status || (ad.isActive ? 'published' : 'paused');

/** A never-blank name for an ad, for headings and confirmation copy. */
export const adName = (ad: Advertisement) =>
  ad.title?.trim() || `Untitled ${typeLabelOf(ad.type).toLowerCase()}`;
