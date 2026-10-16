import React from 'react';
import type { AuditAction } from '../../types/audit.types';
import { groupStyle } from './auditStyle';

/** An action as a coloured pill; sensitive actions carry a red dot. */
const AuditActionBadge: React.FC<{ action: AuditAction; size?: 'sm' | 'md' }> = ({ action, size = 'md' }) => {
  const { pill, icon: Icon } = groupStyle(action.group);
  return (
    <span
      className={`inline-flex items-center rounded-full border border-current shadow-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${pill} ${
        size === 'sm' ? 'gap-1 px-2.5 py-0.5' : 'gap-1.5 px-3 py-1'
      }`}
      title={action.sensitive ? 'Sensitive action' : undefined}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {action.label}
      {action.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="sensitive" />}
    </span>
  );
};

export default AuditActionBadge;
