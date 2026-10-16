import React from 'react';
import { ArrowDown, ArrowUp, Calendar, ChevronRight } from 'lucide-react';
import { UserTypeBadge } from '../UI';
import type { AuditTeamMember, AuditTeamQuery } from '../../types/audit.types';
import { initials, shortTime, timeAgo } from './auditStyle';

export type AdminSortKey = NonNullable<AuditTeamQuery['sort']>;
export type AdminActivityFilter = '' | NonNullable<AuditTeamQuery['activity']>;

export const ADMIN_ACTIVITY_FILTERS: { key: AdminActivityFilter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'sensitive', label: 'Sensitive' },
  { key: 'none', label: 'No activity' },
];

interface AuditAdminsTableProps {
  rows: AuditTeamMember[];
  sort: AdminSortKey;
  order: 'asc' | 'desc';
  onSort: (key: AdminSortKey) => void;
  onSelectAdmin: (adminId: string) => void;
}

const TH = 'px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200';
const TD = 'px-6 py-4 border-b border-gray-300';

const SortHeader: React.FC<{
  label: string;
  sortKey: AdminSortKey;
  className?: string;
  sort: AdminSortKey;
  order: 'asc' | 'desc';
  onSort: (key: AdminSortKey) => void;
}> = ({ label, sortKey, className = '', sort, order, onSort }) => (
  <th className={`${TH} ${className}`}>
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      data-testid={`audit-admins-sort-${sortKey}`}
      className={`inline-flex items-center gap-1 uppercase tracking-wider ${sort === sortKey ? 'text-gray-900' : 'hover:text-gray-900'}`}
    >
      {label}
      {sort === sortKey && (order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  </th>
);

const StatusPill: React.FC<{ status?: string }> = ({ status }) =>
  status && status !== 'active' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700">
      {status}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-100 text-green-700">
      Active
    </span>
  );

const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => (
  <div className={`${size === 'md' ? 'w-10 h-10 text-sm' : 'w-9 h-9 text-xs'} rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100`}>
    <span className="font-bold text-blue-600 uppercase">{initials(name)}</span>
  </div>
);

/**
 * Every admin account with what they did in the selected period. Search,
 * filters, sorting and paging run on the server (the page owns them), so this
 * reads the same with 5 admins or 500. Choosing a row opens that admin's log.
 */
const AuditAdminsTable: React.FC<AuditAdminsTableProps> = ({ rows, sort, order, onSort, onSelectAdmin }) => {
  const sortProps = { sort, order, onSort };
  return (
    <>
      <div className="hidden md:block bg-white" data-testid="audit-admins">
        <table className="min-w-full table-fixed border-separate border-spacing-0">
          <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
            <tr>
              <SortHeader {...sortProps} label="Admin" sortKey="name" className="w-[28%]" />
              <th className={`${TH} w-[13%]`}>Role</th>
              <th className={`${TH} w-[10%]`}>Status</th>
              <SortHeader {...sortProps} label="Actions" sortKey="actions" className="w-[10%]" />
              <SortHeader {...sortProps} label="Sensitive" sortKey="sensitive" className="w-[10%]" />
              <SortHeader {...sortProps} label="Last Login" sortKey="lastLogin" className="w-[14%]" />
              <SortHeader {...sortProps} label="Last Action" sortKey="lastActionAt" className="w-[14%]" />
              <th className={`${TH} w-[5%]`} />
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((admin) => (
              <tr
                key={admin._id}
                onClick={() => onSelectAdmin(admin._id)}
                data-testid="audit-admin-row"
                className="group transition-all duration-150 cursor-pointer hover:bg-gray-50"
              >
                <td className={`${TD} whitespace-nowrap`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={admin.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{admin.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{admin.email}</p>
                    </div>
                  </div>
                </td>
                <td className={TD}>
                  <UserTypeBadge userType={admin.userType} size="sm" />
                </td>
                <td className={TD}>
                  <StatusPill status={admin.accountStatus} />
                </td>
                <td className={`${TD} text-sm font-black text-gray-900`}>{admin.actions}</td>
                <td className={TD}>
                  {admin.sensitive > 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700">{admin.sensitive}</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-300">0</span>
                  )}
                </td>
                {[admin.lastLogin, admin.lastActionAt].map((value, i) => (
                  <td key={i} className={TD}>
                    <p className="text-xs font-bold text-gray-900 whitespace-nowrap">{timeAgo(value)}</p>
                    {value && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase mt-1 whitespace-nowrap">
                        <Calendar className="h-3 w-3" />
                        {shortTime(value)}
                      </div>
                    )}
                  </td>
                ))}
                <td className={`${TD} text-gray-300 group-hover:text-gray-500`}>
                  <ChevronRight className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden px-3 py-3 space-y-2">
        {rows.map((admin) => (
          <div
            key={admin._id}
            onClick={() => onSelectAdmin(admin._id)}
            data-testid="audit-admin-card"
            className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between px-3 py-2 gap-1.5 bg-gray-50/80 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <UserTypeBadge userType={admin.userType} size="sm" />
                <StatusPill status={admin.accountStatus} />
              </div>
              <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase tracking-widest">
                Login {timeAgo(admin.lastLogin)}
              </span>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-3">
              <Avatar name={admin.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900 leading-tight truncate">{admin.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{admin.email}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
            <div className="px-3 pb-2.5 flex items-center gap-4 border-t border-dashed border-gray-100 pt-2">
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Actions</span>
                <span className="text-xs font-black text-gray-900">{admin.actions}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Sensitive</span>
                <span className={`text-xs font-black ${admin.sensitive ? 'text-red-600' : 'text-gray-900'}`}>{admin.sensitive}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Last Action</span>
                <span className="text-xs font-bold text-gray-700 truncate">{timeAgo(admin.lastActionAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AuditAdminsTable;
