import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, Briefcase, CreditCard, LayoutDashboard, MessageSquare, Settings, Shield, Users } from 'lucide-react';
import type { AdminSection } from '../../utils/adminPermissions';

export interface NavLinkItem {
  readonly name: string;
  readonly href: string;
}

export interface NavLinkEntry extends NavLinkItem {
  readonly kind: 'link';
  readonly icon: LucideIcon;
  readonly permission: AdminSection;
}

export type NavGroupKey = 'jobs' | 'users' | 'transactions' | 'settings';

export interface NavGroupEntry {
  readonly kind: 'group';
  readonly key: NavGroupKey;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly permission: AdminSection;
  readonly pathPrefix: string;
  readonly testId?: string;
  readonly items: readonly NavLinkItem[];
}

export type NavEntry = NavLinkEntry | NavGroupEntry;

export const navTestId = (name: string): string => `admin-nav-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export const NAVIGATION: readonly NavEntry[] = [
  { kind: 'link', name: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'dashboard' },
  {
    kind: 'group', key: 'jobs', label: 'Jobs', icon: Briefcase, permission: 'jobs', pathPrefix: '/jobs',
    items: [{ name: 'All Jobs', href: '/jobs' }, { name: 'Archived', href: '/jobs/archived' }],
  },
  {
    kind: 'group', key: 'users', label: 'Users', icon: Users, permission: 'users', pathPrefix: '/users', testId: 'admin-nav-users-group',
    items: [
      { name: 'All Users', href: '/users' },
      { name: 'Customers', href: '/users/customers' },
      { name: 'Service Providers', href: '/users/providers' },
      { name: 'Flagged & Suspended', href: '/users/flagged' },
      { name: 'Deleted Users', href: '/users/deleted' },
    ],
  },
  {
    kind: 'group', key: 'transactions', label: 'Transactions', icon: CreditCard, permission: 'transactions', pathPrefix: '/transactions',
    items: [
      { name: 'Fee Records', href: '/transactions/fee-records' },
      { name: 'Top-up', href: '/transactions/top-up' },
      { name: 'Cashout', href: '/transactions/cashout' },
      { name: 'Refund', href: '/transactions/refund' },
    ],
  },
  { kind: 'link', name: 'Verifications', href: '/verifications', icon: Shield, permission: 'verifications' },
  { kind: 'link', name: 'Support', href: '/support', icon: MessageSquare, permission: 'support' },
  { kind: 'link', name: 'Activity', href: '/activity', icon: Activity, permission: 'activity' },
  { kind: 'link', name: 'Flagged', href: '/flagged', icon: AlertTriangle, permission: 'flagged' },
  {
    kind: 'group', key: 'settings', label: 'Settings', icon: Settings, permission: 'settings', pathPrefix: '/settings',
    items: [{ name: 'Management', href: '/settings/management' }, { name: 'Configuration', href: '/settings/configuration' }],
  },
];
