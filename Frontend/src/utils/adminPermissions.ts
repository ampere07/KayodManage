import type { AdminPermissions } from '../types/configuration.types';

export type AdminSection = keyof AdminPermissions;

export interface PermissionHolder {
  role?: string;
  permissions?: AdminPermissions;
}

export const hasAdminPermission = (holder: PermissionHolder | null | undefined, section: AdminSection): boolean => {
  if (holder?.role === 'superadmin') return true;
  return holder?.permissions?.[section] === true;
};
