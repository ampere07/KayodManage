import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { hasAdminPermission } from '../../utils/adminPermissions';
import type { PermissionHolder } from '../../utils/adminPermissions';
import { NAVIGATION, navTestId } from './navigationModel';
import type { NavGroupEntry, NavGroupKey, NavLinkEntry } from './navigationModel';

export type SidebarVariant = 'mobile' | 'desktop';

const VARIANT_STYLE: Record<SidebarVariant, { entry: string; icon: string; chevron: string; submenu: string; subLink: string }> = {
  mobile: { entry: 'px-3 py-3 text-base', icon: 'mr-4 h-6 w-6', chevron: 'h-5 w-5', submenu: 'ml-11', subLink: 'px-3 py-2.5' },
  desktop: { entry: 'px-2 py-2 text-sm', icon: 'mr-3 h-5 w-5', chevron: 'h-4 w-4', submenu: 'ml-10', subLink: 'px-2 py-2' },
};

interface SidebarNavProps {
  readonly variant: SidebarVariant;
  readonly user: PermissionHolder | null;
  readonly openGroups: Readonly<Record<NavGroupKey, boolean>>;
  readonly onToggleGroup: (key: NavGroupKey) => void;
  readonly onNavigate?: () => void;
}

const entryTone = (active: boolean) => (active ? 'bg-blue-100 text-blue-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900');
const iconTone = (active: boolean) => (active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500');

const SidebarNav: React.FC<SidebarNavProps> = ({ variant, user, openGroups, onToggleGroup, onNavigate }) => {
  const location = useLocation();
  const style = VARIANT_STYLE[variant];
  const granted = NAVIGATION.filter((entry) => hasAdminPermission(user, entry.permission));

  const renderLink = (entry: NavLinkEntry) => {
    const active = location.pathname === entry.href;
    return (
      <Link key={entry.name} data-testid={navTestId(entry.name)} to={entry.href} onClick={onNavigate} className={`group flex items-center ${style.entry} font-medium rounded-md transition-colors ${entryTone(active)}`}>
        <entry.icon className={`${style.icon} ${iconTone(active)}`} />
        {entry.name}
      </Link>
    );
  };

  const renderGroup = (entry: NavGroupEntry) => {
    const inSection = location.pathname.startsWith(entry.pathPrefix);
    const open = openGroups[entry.key];
    return (
      <div key={entry.key}>
        <button type="button" data-testid={entry.testId} onClick={() => onToggleGroup(entry.key)} className={`w-full group flex items-center justify-between ${style.entry} font-medium rounded-md transition-colors ${entryTone(inSection)}`}>
          <div className="flex items-center">
            <entry.icon className={`${style.icon} ${iconTone(inSection)}`} />
            <span>{entry.label}</span>
          </div>
          {open ? <ChevronDown className={style.chevron} /> : <ChevronRight className={style.chevron} />}
        </button>
        {open && (
          <div className={`${style.submenu} mt-1 space-y-1`}>
            {entry.items.map((item) => {
              const active = location.pathname === item.href;
              return (
                <Link key={item.name} data-testid={navTestId(item.name)} to={item.href} onClick={onNavigate} className={`block ${style.subLink} text-sm font-medium rounded-md transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return <>{granted.map((entry) => (entry.kind === 'link' ? renderLink(entry) : renderGroup(entry)))}</>;
};

export default SidebarNav;
