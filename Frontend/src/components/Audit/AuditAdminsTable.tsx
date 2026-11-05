import React from 'react';
import { Clock, LogIn, ShieldAlert } from 'lucide-react';
import { SortHeader } from '../UI/ListControls';
import type { AuditTeamMember, AuditTeamQuery } from '../../types/audit.types';
import { initials, roleLabel, roleText, shortTime, timeAgo } from './auditStyle';

export type AdminSortKey = NonNullable<AuditTeamQuery['sort']>;
export type AdminActivityFilter = '' | NonNullable<AuditTeamQuery['activity']>;

interface AuditAdminsTableProps {
  rows: AuditTeamMember[];
  sort: AdminSortKey;
  order: 'asc' | 'desc';
  onSort: (key: AdminSortKey) => void;
  onSelectAdmin: (adminId: string) => void;
}

const TH = 'px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200';
const TD = 'px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle';

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
    <span className="text-sm font-bold text-blue-600 uppercase">{initials(name)}</span>
  </div>
);

/** Access to the portal, in the list badges' style: on, or the reason it's off. */
const AccessBadge: React.FC<{ status?: string; small?: boolean }> = ({ status, small }) => {
  const off = Boolean(status && status !== 'active');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase whitespace-nowrap ${
        small ? 'px-2 py-0.5 text-[9px] tracking-tight' : 'px-2.5 py-1 text-[10px] tracking-wider'
      } ${off ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${off ? 'bg-red-500' : 'bg-emerald-500'}`} />
      {off ? status : 'Active'}
    </span>
  );
};

/** "12 actions · 3 sensitive", with sign-ins under it. */
const ActivityText: React.FC<{ admin: AuditTeamMember }> = ({ admin }) => (
  <>
    <p className="text-xs font-bold text-gray-900">
      {admin.actions ? `${admin.actions.toLocaleString()} action${admin.actions === 1 ? '' : 's'}` : <span className="text-gray-400 font-semibold">No actions</span>}
      {admin.sensitive > 0 && (
        <span className="text-red-600"> · {admin.sensitive} sensitive</span>
      )}
    </p>
    <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
      <LogIn className="h-3 w-3 text-gray-400" />
      {admin.logins ? `${admin.logins} sign-in${admin.logins === 1 ? '' : 's'}` : 'No sign-ins'}
    </p>
  </>
);

/**
 * Every admin account with what they did in the selected period, in the other
 * list pages' row style. Search, filters, sorting and paging run on the server
 * (the page owns them), so this reads the same with 5 admins or 500. Choosing
 * a row opens that admin's log.
 */
const AuditAdminsTable: React.FC<AuditAdminsTableProps> = ({ rows, sort, order, onSort, onSelectAdmin }) => {
  const dir = (key: AdminSortKey) => (sort === key ? order : null);
  return (
    <>
      <div className="hidden lg:block bg-white" data-testid="audit-admins">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
            <tr>
              <th className={`${TH} w-[32%]`}>
                <SortHeader label="Admin" dir={dir('name')} onClick={() => onSort('name')} />
              </th>
              <th className={`${TH} w-[14%]`}>Access</th>
              <th className={`${TH} w-[20%]`}>
                <SortHeader label="Activity" dir={dir('actions')} onClick={() => onSort('actions')} />
              </th>
              <th className={`${TH} w-[17%]`}>
                <SortHeader label="Signed in" dir={dir('lastLogin')} onClick={() => onSort('lastLogin')} />
              </th>
              <th className={`${TH} w-[17%]`}>
                <SortHeader label="Last action" dir={dir('lastActionAt')} onClick={() => onSort('lastActionAt')} />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((admin) => (
              <tr
                key={admin._id}
                onClick={() => onSelectAdmin(admin._id)}
                data-testid="audit-admin-row"
                className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
              >
                <td className={TD}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={admin.name} />
                    <div className="min-w-0">
                      <p className={`text-[9px] font-black uppercase tracking-wider ${roleText(admin.userType)}`}>{roleLabel(admin.userType)}</p>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{admin.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{admin.email}</p>
                    </div>
                  </div>
                </td>
                <td className={TD}>
                  <AccessBadge status={admin.accountStatus} />
                </td>
                <td className={TD}>
                  <ActivityText admin={admin} />
                </td>
                {[admin.lastLogin, admin.lastActionAt].map((value, i) => (
                  <td key={i} className={TD}>
                    <p className={`text-xs font-bold truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>{timeAgo(value)}</p>
                    {value && <p className="text-[10px] font-medium text-gray-400 mt-1">{shortTime(value)}</p>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones and tablets */}
      <div className="lg:hidden bg-white px-3 py-3 space-y-2">
        {rows.map((admin) => (
          <div
            key={admin._id}
            onClick={() => onSelectAdmin(admin._id)}
            data-testid="audit-admin-card"
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
              <Avatar name={admin.name} />
              <div className="flex-1 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-wider ${roleText(admin.userType)}`}>{roleLabel(admin.userType)}</p>
                <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{admin.name}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 min-w-0">
                  {admin.sensitive > 0 ? <ShieldAlert className="h-3 w-3 text-red-500 flex-shrink-0" /> : null}
                  <span className="truncate">
                    {admin.actions} action{admin.actions === 1 ? '' : 's'}
                    {admin.sensitive > 0 && <span className="text-red-600"> · {admin.sensitive} sensitive</span>}
                  </span>
                </p>
              </div>
              <AccessBadge status={admin.accountStatus} small />
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
              <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-500 truncate">{admin.email}</p>
              <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                <Clock className="h-2.5 w-2.5" />
                Signed in {timeAgo(admin.lastLogin)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AuditAdminsTable;
