/**
 * Audit log types — mirror Backend/app/controllers/activityLogController.js and
 * getAdminActivity in adminController.js. The action list itself is not
 * duplicated here: it comes from GET /api/admin/activity-logs/catalog.
 */

export interface AuditGroup {
  key: string;
  label: string;
}

export interface AuditAction {
  key: string;
  label: string;
  group: string;
  sensitive: boolean;
}

export interface AuditCatalog {
  groups: AuditGroup[];
  actions: AuditAction[];
}

export interface AuditChange {
  from: unknown;
  to: unknown;
}

export interface AuditMetadata {
  targetName?: string | null;
  changes?: Record<string, AuditChange>;
  granted?: string[];
  revoked?: string[];
  reason?: string | null;
  userAgent?: string;
  location?: string;
  [key: string]: unknown;
}

export interface AuditAdmin {
  _id: string;
  name: string;
  email: string;
  userType?: string;
}

export interface AuditTarget {
  _id: string;
  name?: string;
  email?: string;
  title?: string;
  subject?: string;
  description?: string;
}

export interface AuditLogEntry {
  _id: string;
  actionType: string;
  description: string;
  adminId: AuditAdmin | null;
  targetType?: string;
  targetId?: AuditTarget | string | null;
  targetModel?: string;
  metadata?: AuditMetadata;
  ipAddress?: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
}

export interface AuditFilters {
  adminId?: string;
  targetId?: string;
  group?: string;
  actionType?: string;
  sensitive?: boolean;
  from?: string;
  to?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface AuditTeamMember {
  _id: string;
  name: string;
  email: string;
  userType: string;
  accountStatus?: string;
  lastLogin: string | null;
  lastActionAt: string | null;
  actions: number;
  logins: number;
  sensitive: number;
}

export interface AuditTeamQuery {
  from?: string;
  to?: string;
  search?: string;
  activity?: 'active' | 'none' | 'sensitive';
  sort?: 'actions' | 'sensitive' | 'lastLogin' | 'lastActionAt' | 'name';
  order?: 'asc' | 'desc';
  adminId?: string;
  page?: number;
  limit?: number;
}

export interface AuditTeamResponse {
  /** This page of admins, after search/activity filters and sorting. */
  team: AuditTeamMember[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  /** Every admin in the window, regardless of search or page. */
  totals: { admins: number; actions: number; logins: number; sensitive: number; activeAdmins: number };
}

export interface AdminActivityItem {
  _id: string;
  actionType: string;
  action: string;
  group: string | null;
  sensitive: boolean;
  description: string;
  targetType: string | null;
  targetName: string | null;
  metadata: AuditMetadata;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminActivitySummary {
  lastLogin: string | null;
  lastActionAt: string | null;
  last7d: number;
  last30d: number;
  sensitive30d: number;
  logins30d: number;
  byAction30d: { actionType: string; label: string; group: string | null; sensitive: boolean; count: number }[];
}

export interface AdminActivityResponse {
  activities: AdminActivityItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  summary: AdminActivitySummary;
}

export interface AuditTargetFact {
  label: string;
  value: string;
}

/** What an entry was about, read live from its record. */
export interface AuditEntryTarget {
  type: string;
  kind: string;
  id: string | null;
  label: string | null;
  /** false: the record has since been deleted; null: there's no single record (e.g. settings). */
  exists: boolean | null;
  facts: AuditTargetFact[];
}

export interface AuditEntrySummary {
  _id: string;
  actionType: string;
  description: string;
  createdAt: string;
  admin: { _id: string; name: string } | null;
}

export interface AuditEntryDetail {
  log: AuditLogEntry & {
    adminId: (AuditAdmin & { accountStatus?: string; lastLogin?: string | null }) | null;
    userAgent?: string;
  };
  action: { key: string; label: string; group: string | null; groupLabel: string | null; sensitive: boolean };
  origin: { ipAddress: string | null; location: string | null; userAgent: string | null };
  target: AuditEntryTarget | null;
  /** For bulk entries: the records the batch touched (first 50), as they are now. */
  bulk: {
    kind: 'report';
    total: number;
    items: { id: string; kind: string; label: string; detail: string | null; status: string | null; exists: boolean }[];
  } | null;
  aboutTarget: AuditEntrySummary[];
  /** All other entries about the same target (aboutTarget holds the latest 10). */
  aboutTargetTotal: number;
  /** Where this entry sits in its admin's newest-first history (position is 0-based). */
  adminHistory: { total: number; position: number };
}
