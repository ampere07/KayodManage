import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Users } from 'lucide-react';
import { useAuditTeam } from '../../hooks/useAudit';
import { initials, roleLabel } from './auditStyle';

interface AuditAdminPickerProps {
  value?: string;
  /** Name to show for the selected admin (the picker only loads matches while open). */
  selectedLabel?: string;
  range: { from?: string; to?: string };
  onChange: (adminId?: string) => void;
}

const MATCHES = 8;

/**
 * The "which admin" filter. Searches admin accounts on the server and shows a
 * handful of matches (busiest first), so it stays usable at any team size.
 */
const AuditAdminPicker: React.FC<AuditAdminPickerProps> = ({ value, selectedLabel, range, onChange }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { data, isFetching } = useAuditTeam({ ...range, search: search || undefined, sort: 'actions', limit: MATCHES }, open);

  const pick = (adminId?: string) => {
    onChange(adminId);
    setOpen(false);
    setInput('');
  };

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="audit-admin-picker"
        aria-expanded={open}
        className={`w-full h-8 md:h-auto md:py-2 inline-flex items-center gap-2 rounded-lg md:rounded-xl border shadow-sm px-2 md:px-3 text-[11px] md:text-xs font-black uppercase tracking-wider min-w-0 md:min-w-[170px] md:max-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
          value ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-600 bg-white'
        }`}
      >
        <Users className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
        <span className="truncate flex-1 text-left">{value ? selectedLabel || 'Selected admin' : 'All Admins'}</span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-40 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-lg"
          data-testid="audit-admin-picker-menu"
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Find an admin by name or email"
                data-testid="audit-admin-picker-search"
                className="w-full h-8 pl-8 pr-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {!search && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(undefined)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-gray-800 flex-1">All admins</span>
                  {!value && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              </li>
            )}
            {(data?.team || []).map((admin) => (
              <li key={admin._id}>
                <button
                  type="button"
                  onClick={() => pick(admin._id)}
                  data-testid="audit-admin-option"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {initials(admin.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-gray-900 truncate">{admin.name}</span>
                    <span className="block text-[10px] text-gray-500 truncate">
                      {roleLabel(admin.userType)} · {admin.actions} action{admin.actions === 1 ? '' : 's'}
                      {admin.sensitive > 0 && <span className="text-red-600"> · {admin.sensitive} sensitive</span>}
                    </span>
                  </span>
                  {value === admin._id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              </li>
            ))}
            {data && data.team.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-gray-500">No admin matches “{search}”</li>
            )}
            {!data && isFetching && <li className="px-3 py-4 text-center text-xs text-gray-400">Loading…</li>}
          </ul>
          {data && data.total > data.team.length && (
            <p className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500">
              Showing the {data.team.length} busiest of {data.total} — type to narrow down
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditAdminPicker;
