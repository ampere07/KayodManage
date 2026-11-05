import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '../../services';
import { IMAGEKIT_URL_ENDPOINT, generateProfessionIconFilename } from '../../constants/categoryIcons';
import { getServiceClass, normalizeServiceClass, type ServiceClassId } from '../../constants/serviceClasses';
import type { JobCategory, Profession } from '../../types/configuration.types';

/**
 * Job categories and professions as Settings → Configuration shows them: the
 * icon the Kayod app actually displays, the payment class that actually
 * applies, and how much each one is in use.
 */

/** Most professions a client home screen shows under Popular Categories. */
export const POPULAR_LIMIT = 8;

/**
 * The URL the Kayod app loads for a profession's icon. The app ignores the
 * stored `icon` field and builds this from the NAME (kayod/client
 * categoryVisualMapping.getProfessionVisuals), with ?updatedAt= so a replaced
 * icon isn't served from cache. Showing the same URL here means the admin sees
 * exactly what clients see — including when there's no icon at all.
 */
export const professionIconUrl = (name: string, updatedAt?: string | Date | null) => {
  const ts = updatedAt ? new Date(updatedAt).getTime() : NaN;
  return `${IMAGEKIT_URL_ENDPOINT}/professionIconsUpload/${generateProfessionIconFilename(name)}${Number.isFinite(ts) ? `?updatedAt=${ts}` : ''}`;
};

/** The file the icon is stored as, which the app looks for by name. */
export const professionIconFile = (name: string) => `professionIconsUpload/${generateProfessionIconFilename(name)}`;

export type PopularEntry = Profession & { categoryName: string };

/** The professions under Popular Categories on the client home screen, in order. */
export const popularOf = (categories: JobCategory[]): PopularEntry[] =>
  categories
    .flatMap((category) => (category.professions || []).map((p) => ({ ...p, categoryName: category.name })))
    .filter((p) => p.isQuickAccess)
    .sort((a, b) => (a.quickAccessOrder || 0) - (b.quickAccessOrder || 0));

/** The class a profession's jobs get: its own override, else its category's. */
export const effectiveClass = (profession: Pick<Profession, 'serviceClass'>, category: Pick<JobCategory, 'serviceClass'>): ServiceClassId =>
  normalizeServiceClass(profession.serviceClass ?? category.serviceClass);

export const className = (id: string | null | undefined) => getServiceClass(id).label;

export interface Usage {
  jobs: number;
  activeJobs: number;
  providers: number;
}
export interface UsageMap {
  professions: Record<string, Usage>;
  categories: Record<string, Usage>;
}
export const NO_USAGE: Usage = { jobs: 0, activeJobs: 0, providers: 0 };

/** Jobs and providers per category and profession (refreshed with the categories). */
export const useCategoryUsage = () =>
  useQuery<UsageMap>({
    queryKey: ['job-categories', 'usage'],
    queryFn: async () => {
      const response = await settingsService.getJobCategoryUsage();
      return { professions: response.professions || {}, categories: response.categories || {} };
    },
    staleTime: 30_000,
  });

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "3 providers · 12 jobs (2 active)" — or "No providers yet". */
export const usageLine = (usage: Usage | undefined) => {
  if (!usage) return '';
  const parts = [usage.providers ? plural(usage.providers, 'provider') : 'No providers'];
  if (usage.jobs) parts.push(`${plural(usage.jobs, 'job')}${usage.activeJobs ? ` (${usage.activeJobs} active)` : ''}`);
  return parts.join(' · ');
};
export const providersText = (n: number) => plural(n, 'provider');
export const jobsText = (n: number) => plural(n, 'job');

export type IconState = 'loading' | 'ok' | 'missing';

/**
 * The backend's answer for every profession (GET …/job-categories/icon-check):
 * it sends a HEAD request to the same URL the app loads, so the browser never
 * has to request a missing file — each of which would log a 404 here. Keyed by
 * that URL; true = there, false = missing, null = the server couldn't tell.
 */
export const useIconCheck = () =>
  useQuery<Map<string, boolean | null>>({
    queryKey: ['job-categories', 'icon-check'],
    queryFn: async () => {
      const response = await settingsService.getProfessionIconCheck();
      const answers = new Map<string, boolean | null>();
      for (const icon of response.icons || []) answers.set(professionIconUrl(icon.name, icon.updatedAt), icon.exists ?? null);
      return answers;
    },
    staleTime: 60_000,
    retry: false,
  });

// What the browser learnt itself, for URLs the server couldn't answer (an
// older backend, ImageKit unreachable from the server). Kept for the page's
// lifetime; a new upload changes the URL (?updatedAt=) and so is a new entry.
const probed = new Map<string, IconState>();
const listeners = new Set<() => void>();
const probe = (url: string) => {
  if (probed.has(url)) return;
  probed.set(url, 'loading');
  const img = new Image();
  const settle = (state: IconState) => {
    probed.set(url, state);
    listeners.forEach((notify) => notify());
  };
  img.onload = () => settle('ok');
  img.onerror = () => settle('missing');
  img.src = url;
};

/**
 * Whether each icon URL is there, as the app would find it: from the
 * backend's check, falling back to loading the image in the browser only for
 * what the check couldn't answer.
 */
export const useIconStates = (urls: string[]) => {
  const check = useIconCheck();
  // Bumped as browser probes settle, so the getter (and anything memoised on it) updates.
  const [version, bump] = useState(0);
  const key = urls.join('\n');
  const unanswered = (url: string) => {
    const answer = check.data?.get(url);
    return answer === undefined || answer === null;
  };

  useEffect(() => {
    const notify = () => bump((n) => n + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    if (check.isLoading) return;
    urls.filter(unanswered).forEach(probe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, check.data, check.isLoading]);

  return useMemo(
    () => (url: string): IconState => {
      const answer = check.data?.get(url);
      if (answer === true) return 'ok';
      if (answer === false) return 'missing';
      if (check.isLoading) return 'loading';
      return probed.get(url) || 'loading';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, check.data, check.isLoading, version]
  );
};
