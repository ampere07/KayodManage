import apiClient from '../utils/apiClient';
import type {
  AdminActivityResponse,
  AuditCatalog,
  AuditEntryDetail,
  AuditFilters,
  AuditLogsResponse,
  AuditTeamQuery,
  AuditTeamResponse,
} from '../types/audit.types';

/** Drop empty values so the query string only carries filters that are set. */
const params = (values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== '' && v !== false && v !== 'all'));

/** The audit log. Every endpoint here is superadmin-only on the server. */
export const auditService = {
  async getCatalog(): Promise<AuditCatalog> {
    const response = await apiClient.get('/api/admin/activity-logs/catalog');
    return response.data;
  },

  async getLogs(filters: AuditFilters): Promise<AuditLogsResponse> {
    const response = await apiClient.get('/api/admin/activity-logs', { params: params({ ...filters }) });
    return response.data;
  },

  /**
   * The current view (same filters, no paging) as a CSV file, up to 5,000 rows.
   * Returns the file and how many of the matching entries it holds.
   */
  async exportCsv(filters: Omit<AuditFilters, 'page' | 'limit'>): Promise<{ blob: Blob; filename: string; count: number; total: number }> {
    const response = await apiClient.get('/api/admin/activity-logs/export', { params: params({ ...filters }), responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] || '');
    return {
      blob: response.data,
      filename: disposition.match(/filename="([^"]+)"/)?.[1] || 'kayod-audit-log.csv',
      count: Number(response.headers['x-export-count']) || 0,
      total: Number(response.headers['x-export-total']) || 0,
    };
  },

  async getEntry(logId: string): Promise<AuditEntryDetail> {
    const response = await apiClient.get(`/api/admin/activity-logs/${logId}`);
    return response.data;
  },

  async getTeam(query: AuditTeamQuery): Promise<AuditTeamResponse> {
    const response = await apiClient.get('/api/admin/activity-logs/team', { params: params({ ...query }) });
    return response.data;
  },

  async getAdminActivity(adminId: string, page = 1, limit = 15): Promise<AdminActivityResponse> {
    const response = await apiClient.get(`/api/admin/admins/${adminId}/activity`, { params: { page, limit } });
    return response.data;
  },
};

export default auditService;
