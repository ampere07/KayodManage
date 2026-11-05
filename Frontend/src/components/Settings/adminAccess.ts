import type { Tone } from '../UI/CounterGroups';

/**
 * What an admin account is and what it can open, shared by the Management list
 * and the create / edit panels so they use the same words.
 */

export type PermissionKey =
  | 'dashboard'
  | 'users'
  | 'jobs'
  | 'transactions'
  | 'verifications'
  | 'support'
  | 'activity'
  | 'flagged'
  | 'settings';
export type Permissions = Record<PermissionKey, boolean>;

/** Every page a permission switches on, in sidebar order and under its sidebar name. */
export const PAGES: { key: PermissionKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'users', label: 'Users' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'verifications', label: 'Verifications' },
  { key: 'support', label: 'Support' },
  { key: 'activity', label: 'Audit Log' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'settings', label: 'Settings' },
];

export const permissionsFor = (pages: PermissionKey[]): Permissions =>
  Object.fromEntries(PAGES.map(({ key }) => [key, pages.includes(key)])) as Permissions;

export const NO_PERMISSIONS = permissionsFor([]);

export type PresetKey = 'full' | 'admin' | 'finance' | 'support';

/** Ready-made page sets (the old permission templates, unchanged). */
export const PRESETS: { key: PresetKey; label: string; description: string; pages: PermissionKey[] }[] = [
  { key: 'full', label: 'Full access', description: 'Every page, Settings included', pages: PAGES.map((p) => p.key) },
  { key: 'admin', label: 'Admin', description: 'Every page except Settings', pages: PAGES.map((p) => p.key).filter((k) => k !== 'settings') },
  { key: 'finance', label: 'Finance', description: 'Dashboard, Transactions, Support, Audit Log', pages: ['dashboard', 'transactions', 'support', 'activity'] },
  { key: 'support', label: 'Support', description: 'Dashboard, Jobs, Users, Verifications, Support, Flagged', pages: ['dashboard', 'jobs', 'users', 'verifications', 'support', 'flagged'] },
];

/** The preset these permissions match exactly, or null when they're custom. */
export const presetOf = (permissions?: Partial<Permissions> | null) =>
  PRESETS.find((preset) => PAGES.every(({ key }) => Boolean(permissions?.[key]) === preset.pages.includes(key))) || null;

export const pagesOn = (permissions?: Partial<Permissions> | null) => PAGES.filter(({ key }) => permissions?.[key]);

/** "Every page", "All but Settings", "4 of 9 pages" or "No pages". */
export const pagesSummary = (permissions?: Partial<Permissions> | null) => {
  const on = pagesOn(permissions);
  if (on.length === PAGES.length) return 'Every page';
  if (!on.length) return 'No pages';
  const off = PAGES.filter(({ key }) => !permissions?.[key]);
  if (off.length <= 2) return `All but ${off.map((p) => p.label).join(' and ')}`;
  return `${on.length} of ${PAGES.length} pages`;
};

export type RoleKey = 'superadmin' | 'admin' | 'finance' | 'support';

/** Roles in the Audit Log's colours (auditStyle.roleText). `value` is what the server stores. */
export const ROLES: { key: RoleKey; value: string; label: string; description: string; tone: Tone }[] = [
  { key: 'superadmin', value: 'superadmin', label: 'Superadmin', description: 'Everything, including admin accounts', tone: 'red' },
  { key: 'admin', value: 'admin', label: 'Admin', description: 'Day-to-day running of the portal', tone: 'orange' },
  { key: 'finance', value: 'finance', label: 'Finance', description: 'Money and transactions', tone: 'emerald' },
  { key: 'support', value: 'customer support', label: 'Support', description: 'Tickets and helping users', tone: 'blue' },
];

/** The list sends roles capitalised ("Customer support"); older accounts may say "support". */
export const roleKeyOf = (role?: string | null): RoleKey | null => {
  const r = (role || '').toLowerCase();
  if (r === 'customer support' || r === 'support') return 'support';
  return r === 'superadmin' || r === 'admin' || r === 'finance' ? r : null;
};

export const roleOf = (role?: string | null) => ROLES.find((r) => r.key === roleKeyOf(role)) || null;

/** Sign-in is refused for any status but active (authController). */
export const canSignIn = (status?: string | null) => status === 'active';

export const ACCESS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];

/** An active account with no sign-in for this long needs a look. */
export const INACTIVE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/** Whether an active account has signed in lately. Accounts with access off are left out. */
export const signInConcern = (admin: { accountStatus?: string; lastLogin?: string | null }): 'never' | 'inactive' | null => {
  if (!canSignIn(admin.accountStatus)) return null;
  if (!admin.lastLogin) return 'never';
  return Date.now() - new Date(admin.lastLogin).getTime() >= INACTIVE_DAYS * DAY ? 'inactive' : null;
};

export const daysSince = (value: string) => Math.floor((Date.now() - new Date(value).getTime()) / DAY);
