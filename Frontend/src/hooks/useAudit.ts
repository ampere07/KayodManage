import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditService } from '../services/auditService';
import type { AuditFilters, AuditTeamQuery } from '../types/audit.types';

export const AUDIT_QUERY_KEY = 'audit';

// The app-wide default skips refetching on mount; the log should be current
// whenever it's opened, so these queries refetch on mount once stale.

/** Loggable actions, their groups and labels. Fixed for a given backend build. */
export const useAuditCatalog = () =>
  useQuery({
    queryKey: [AUDIT_QUERY_KEY, 'catalog'],
    queryFn: () => auditService.getCatalog(),
    staleTime: Infinity,
  });

export const useAuditLogs = (filters: AuditFilters, enabled = true) =>
  useQuery({
    queryKey: [AUDIT_QUERY_KEY, 'logs', filters],
    queryFn: () => auditService.getLogs(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnMount: true,
  });

/** Admins with their activity in a window — paged, searchable and sortable on the server. */
export const useAuditTeam = (query: AuditTeamQuery, enabled = true) =>
  useQuery({
    queryKey: [AUDIT_QUERY_KEY, 'team', query],
    queryFn: () => auditService.getTeam(query),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnMount: true,
  });

export const useAdminActivity = (adminId: string | undefined, limit: number, enabled = true) =>
  useQuery({
    queryKey: [AUDIT_QUERY_KEY, 'admin', adminId, limit],
    queryFn: () => auditService.getAdminActivity(adminId!, 1, limit),
    enabled: Boolean(adminId) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnMount: true,
  });

/** One entry with its context (origin, live target, related history). */
export const useAuditEntry = (logId: string | undefined) =>
  useQuery({
    queryKey: [AUDIT_QUERY_KEY, 'entry', logId],
    queryFn: () => auditService.getEntry(logId!),
    enabled: Boolean(logId),
    staleTime: 15_000,
    refetchOnMount: true,
  });
