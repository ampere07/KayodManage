import {
  Activity,
  Briefcase,
  Flag,
  KeyRound,
  MessageSquare,
  SlidersHorizontal,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { AuditAction, AuditCatalog } from '../../types/audit.types';
import type { Tone } from '../UI/CounterGroups';

// Entries about configuration all open the System Configuration page.
export const CONFIG_TARGET_TYPES = new Set(['settings', 'job_category', 'profession', 'advertisement', 'legal_document']);
/** Target kinds the log can open (a modal or the page that manages them). */
export const OPENABLE_TARGET_TYPES = new Set(['user', 'transaction', 'job', 'support', 'verification', ...CONFIG_TARGET_TYPES]);

/**
 * Look per action *group*, not per action: the catalog (from the backend) owns
 * the list of actions, so a new action gets its group's colour and icon
 * without anything here changing.
 */
const GROUP_STYLE: Record<string, { pill: string; icon: LucideIcon }> = {
  access: { pill: 'bg-purple-100 text-purple-700', icon: KeyRound },
  users: { pill: 'bg-blue-100 text-blue-700', icon: User },
  jobs: { pill: 'bg-orange-100 text-orange-700', icon: Briefcase },
  money: { pill: 'bg-green-100 text-green-700', icon: Wallet },
  support: { pill: 'bg-sky-100 text-sky-700', icon: MessageSquare },
  moderation: { pill: 'bg-rose-100 text-rose-700', icon: Flag },
  config: { pill: 'bg-gray-100 text-gray-700', icon: SlidersHorizontal },
};

const FALLBACK_STYLE = { pill: 'bg-gray-100 text-gray-700', icon: Activity };

export const groupStyle = (group?: string | null) => (group && GROUP_STYLE[group]) || FALLBACK_STYLE;

/**
 * The areas the page counts and filters by: the catalog's groups, with
 * sign-ins split out of Team & access so the areas share out the log with
 * nothing counted twice (the backend's `group=signins` / actionTypesInArea).
 * `text` tints the small area label on rows, in the group's colour.
 */
export const AREAS: { key: string; label: string; tone: Tone; text: string; hint: string }[] = [
  { key: 'access', label: 'Team', tone: 'purple', text: 'text-purple-600', hint: 'Admin accounts created or changed: roles, permissions, passwords, access, exports' },
  { key: 'users', label: 'Users', tone: 'blue', text: 'text-blue-600', hint: 'Verifications, restrictions, bans and deletions' },
  { key: 'jobs', label: 'Jobs', tone: 'orange', text: 'text-orange-600', hint: 'Job status, hiding, deleting, force-cancelling and dispute rulings' },
  { key: 'money', label: 'Money', tone: 'emerald', text: 'text-emerald-600', hint: 'Transactions approved or declined, and bulk approvals' },
  { key: 'support', label: 'Support', tone: 'indigo', text: 'text-indigo-600', hint: 'Tickets accepted, closed and reopened' },
  { key: 'moderation', label: 'Reports', tone: 'red', text: 'text-rose-600', hint: 'Reports reviewed or deleted' },
  { key: 'config', label: 'Settings', tone: 'gray', text: 'text-gray-500', hint: 'Fees, categories, professions, ads and legal documents' },
];
export const SIGN_INS = { key: 'signins', label: 'Sign-ins', tone: 'violet' as Tone, text: 'text-violet-600', hint: 'Admins signing in to the portal' };

export const areaOf = (action: Pick<AuditAction, 'key' | 'group'>) => (action.key === 'admin_login' ? SIGN_INS.key : action.group);
export const areaLook = (key?: string | null) => (key === SIGN_INS.key ? SIGN_INS : AREAS.find((a) => a.key === key));

/** Admin roles in UserTypeBadge's colours (superadmin red, admin orange). */
const ROLE_TEXT: Record<string, string> = {
  superadmin: 'text-red-600',
  admin: 'text-orange-600',
  finance: 'text-emerald-600',
  'customer support': 'text-sky-600',
  support: 'text-sky-600',
};
export const roleText = (role?: string | null) => (role && ROLE_TEXT[role]) || 'text-gray-500';

/** Catalog entry for an action, with a readable fallback for one the catalog doesn't know. */
export const lookupAction = (catalog: AuditCatalog | undefined, actionType: string): AuditAction =>
  catalog?.actions.find((a) => a.key === actionType) || {
    key: actionType,
    label: actionType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    group: '',
    sensitive: false,
  };

const ACRONYMS: Record<string, string> = { asap: 'ASAP', cta: 'CTA', url: 'URL', id: 'ID' };

/** "bookingFeePercentage" → "Booking fee percentage"; "asapFee" → "ASAP fee". */
export const fieldLabel = (field: string) => {
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map((word) => ACRONYMS[word] || word)
    .join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const timeAgo = (value?: string | null) =>
  value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : 'Never';

export const exactTime = (value: string) => format(new Date(value), "MMM d, yyyy 'at' h:mm a");

/** "Oct 10, 8:19 PM" — the year only when it isn't this year. For narrow columns. */
export const shortTime = (value: string) => {
  const date = new Date(value);
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d, h:mm a' : 'MMM d, yyyy');
};

/** 'superadmin' → 'Superadmin', 'customer support' → 'Customer support'. */
export const roleLabel = (role?: string | null) =>
  !role ? '' : role === 'superadmin' ? 'Superadmin' : role.charAt(0).toUpperCase() + role.slice(1);

export const initials = (name?: string | null) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/** "Chrome on Windows" from a user-agent string, or null. */
export const describeDevice = (userAgent?: unknown) => {
  if (typeof userAgent !== 'string' || !userAgent || userAgent === 'Unknown') return null;
  const browser = /Edg\//.test(userAgent) ? 'Edge'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'Browser';
  const os = /Windows/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iOS/.test(userAgent) ? 'iOS'
    : /Mac OS/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : null;
  if (os) return `${browser} on ${os}`;
  // Not a browser we recognise (an API client, a script): show what it called itself.
  return browser === 'Browser' ? userAgent.slice(0, 60) : browser;
};
