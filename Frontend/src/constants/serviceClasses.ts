/**
 * serviceClasses.ts — admin-side display mirror of the service class registry.
 *
 * A job category belongs to a service class, and the class decides how long a
 * completed job's payment is held before the provider is paid: `standard` holds
 * for 5 days (a warranty window, for work that can fail after the provider
 * leaves), `immediate` for 24 hours (work consumed on the spot, where the only
 * thing left to cover is a missed appointment).
 *
 * This is what the category configuration UI reads to render the picker and the
 * badges. The authority is kayod/server/src/config/serviceClasses.js; the write
 * path validates against KayodManage/Backend/app/config/serviceClasses.js. Keep
 * all three in sync by hand — the same arrangement the JobCategory model
 * already uses across the two backends.
 */

export const SERVICE_CLASS = {
  STANDARD: 'standard',
  IMMEDIATE: 'immediate',
} as const;

export type ServiceClassId = (typeof SERVICE_CLASS)[keyof typeof SERVICE_CLASS];

export const DEFAULT_SERVICE_CLASS: ServiceClassId = SERVICE_CLASS.STANDARD;

export interface ServiceClassDefinition {
  id: ServiceClassId;
  label: string;
  /** What kind of work belongs in this class — shown under the picker. */
  description: string;
  /**
   * How long payment is held. Deliberately NOT part of the class's label or
   * badge: the hold window is the only thing that differs between classes
   * today, but the class is a classification of the WORK, and future classes
   * are expected to differ in other ways too. Naming a class by its current
   * duration would bake that assumption into every surface.
   */
  paymentReleaseHours: number;
  /** lucide-react icon name — how the class is denoted where space is tight. */
  icon: 'ShieldCheck' | 'Zap';
  /** Tailwind classes for the badge, so every surface tints it identically. */
  badgeClassName: string;
}

export const SERVICE_CLASSES: Record<ServiceClassId, ServiceClassDefinition> = {
  [SERVICE_CLASS.STANDARD]: {
    id: SERVICE_CLASS.STANDARD,
    label: 'Standard Service',
    description:
      'Work that can develop faults after it is finished — repairs, installations, construction. Payment is held as a warranty.',
    paymentReleaseHours: 120,
    icon: 'ShieldCheck',
    badgeClassName: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  [SERVICE_CLASS.IMMEDIATE]: {
    id: SERVICE_CLASS.IMMEDIATE,
    label: 'Immediate Service',
    description:
      'Work delivered and judged on the spot — wellness, grooming, personal care. Payment is released as soon as both sides confirm the job is complete.',
    // Zero on purpose — see the note in the backend mirror. This file lagged the
    // change and still showed admins a 24-hour hold that no longer existed.
    paymentReleaseHours: 0,
    icon: 'Zap',
    badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

export const SERVICE_CLASS_IDS: ServiceClassId[] = [
  SERVICE_CLASS.STANDARD,
  SERVICE_CLASS.IMMEDIATE,
];

export const isServiceClass = (value: unknown): value is ServiceClassId =>
  typeof value === 'string' && value in SERVICE_CLASSES;

/** Unknown/missing falls back to `standard` — never shorten a hold by accident. */
export const normalizeServiceClass = (value: unknown): ServiceClassId =>
  isServiceClass(value) ? value : DEFAULT_SERVICE_CLASS;

export const getServiceClass = (value: unknown): ServiceClassDefinition =>
  SERVICE_CLASSES[normalizeServiceClass(value)];

/**
 * "24 hours" / "5 days". The 48-hour cut-off matches the client app: the short
 * window reads faster in hours, the long one reads better in days.
 */
export const formatReleaseWindow = (hours: number): string | null => {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 48) {
    const rounded = Math.round(hours);
    return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

/**
 * The window a class settles on, already worded.
 *
 * A zero-hour class has no window, which is a different statement from "we do
 * not know" — so it gets its own phrase rather than the em-dash placeholder an
 * admin would read as missing data.
 */
export const getReleaseWindowLabel = (value: unknown): string => {
  const hours = getServiceClass(value).paymentReleaseHours;
  if (Number.isFinite(hours) && hours <= 0) return 'On confirmation';
  return formatReleaseWindow(hours) ?? '—';
};

/**
 * Resolve the class for a category/profession pair: profession override →
 * category default → `standard`.
 */
export function resolveServiceClass(
  category: { serviceClass?: string | null; professions?: Array<{ name?: string; serviceClass?: string | null }> } | null,
  professionName?: string | null,
): ServiceClassId {
  if (!category) return DEFAULT_SERVICE_CLASS;

  if (professionName) {
    const wanted = professionName.trim().toLowerCase();
    const profession = (category.professions || []).find(
      (entry) => (entry?.name || '').trim().toLowerCase() === wanted,
    );
    if (profession && isServiceClass(profession.serviceClass)) {
      return profession.serviceClass;
    }
  }

  return normalizeServiceClass(category.serviceClass);
}
