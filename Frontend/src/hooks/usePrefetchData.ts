import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { iconCacheService } from '../services/iconCacheService';
import { hasAdminPermission } from '../utils/adminPermissions';
import type { AdminSection } from '../utils/adminPermissions';
import { adminsQuery } from './useAdmins';
import { jobCategoriesQuery } from './useJobs';
import { supportTicketsQuery } from './useSupportTickets';
import { verificationsQuery } from './useVerifications';

const ICON_CACHE_SWEEP_MS = 60 * 60 * 1000;

interface SectionPrefetch {
  readonly sections: readonly AdminSection[];
  readonly run: (queryClient: QueryClient) => Promise<void>;
}

const SECTION_PREFETCHES: readonly SectionPrefetch[] = [
  { sections: ['verifications'], run: (queryClient) => queryClient.prefetchQuery(verificationsQuery()) },
  { sections: ['support'], run: (queryClient) => queryClient.prefetchQuery(supportTicketsQuery()) },
  { sections: ['settings'], run: (queryClient) => queryClient.prefetchQuery(adminsQuery()) },
  {
    sections: ['jobs', 'users', 'settings'],
    run: async (queryClient) => {
      const categories = await queryClient.fetchQuery(jobCategoriesQuery());
      await iconCacheService.preloadProfessionIcons(categories?.categories || []);
    },
  },
];

export const usePrefetchData = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const granted = SECTION_PREFETCHES.filter((prefetch) => prefetch.sections.some((section) => hasAdminPermission(user, section)));
    const prefetchInTurn = async () => {
      for (const prefetch of granted) {
        if (cancelled) return;
        await prefetch.run(queryClient);
      }
    };
    prefetchInTurn().catch((error: unknown) => console.error('[Prefetch] failed:', error));
    const sweep = setInterval(() => iconCacheService.clearExpiredCache(), ICON_CACHE_SWEEP_MS);
    return () => {
      cancelled = true;
      clearInterval(sweep);
    };
  }, [queryClient, user]);
};
