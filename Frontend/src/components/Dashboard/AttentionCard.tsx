import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, Scale, RotateCcw, Flag, ShieldCheck, MessageSquare, Wallet, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { AttentionKey, WaitingQueue } from '../../types/dashboard.types';
import { waitedFor } from './dashboardFormat';

interface QueueRow {
  key: AttentionKey;
  label: string;
  icon: LucideIcon;
  /** Icon tint while something is waiting. */
  tint: string;
  to: string;
}

// Money and safety first: a dispute or refund holds someone's money.
const QUEUES: QueueRow[] = [
  { key: 'disputes', label: 'Disputes to rule on', icon: Scale, tint: 'bg-red-50 text-red-600', to: '/support' },
  { key: 'refunds', label: 'Refund requests', icon: RotateCcw, tint: 'bg-orange-50 text-orange-600', to: '/transactions/refund?status=pending' },
  { key: 'reports', label: 'Reports to review', icon: Flag, tint: 'bg-amber-50 text-amber-600', to: '/flagged' },
  { key: 'verifications', label: 'Verifications waiting', icon: ShieldCheck, tint: 'bg-blue-50 text-blue-600', to: '/verifications' },
  { key: 'support', label: 'Unassigned support tickets', icon: MessageSquare, tint: 'bg-purple-50 text-purple-600', to: '/support' },
  { key: 'cashouts', label: 'Cash-outs pending', icon: Wallet, tint: 'bg-emerald-50 text-emerald-600', to: '/transactions/cashout?status=pending' },
];

const AttentionCard: React.FC<{ attention: Record<AttentionKey, WaitingQueue> }> = ({ attention }) => {
  const waiting = QUEUES.reduce((n, q) => n + (attention[q.key]?.count || 0), 0);

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 tight:p-4 flex flex-col h-full min-h-0" data-testid="dashboard-attention">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Needs attention</h2>
          <p className="text-xs text-gray-500 mt-0.5 tight:hidden">What's waiting on an admin</p>
        </div>
        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap mt-0.5">{waiting} waiting</span>
      </div>

      {waiting === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="mt-2 text-sm font-semibold text-gray-900">All caught up</p>
          <p className="text-xs text-gray-500">Nothing is waiting on an admin right now.</p>
        </div>
      ) : (
        <ul className="mt-3 tight:mt-2 -mx-2 flex-1 min-h-0 flex flex-col divide-y divide-gray-100">
          {QUEUES.map(({ key, label, icon: Icon, tint, to }) => {
            const { count, oldestAt } = attention[key] || { count: 0, oldestAt: null };
            const idle = count === 0;
            return (
              <li key={key} className="flex-1 min-h-[48px] tight:min-h-[38px] flex">
                <Link
                  to={to}
                  data-testid={`dashboard-attention-${key}`}
                  className="w-full flex items-center gap-3 px-2 py-1 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${idle ? 'bg-gray-50 text-gray-400' : tint}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium truncate ${idle ? 'text-gray-500' : 'text-gray-900'}`}>{label}</span>
                    <span className="block text-[11px] text-gray-500 truncate tight:hidden">
                      {idle ? 'Nothing waiting' : `Oldest waiting ${waitedFor(oldestAt)}`}
                    </span>
                  </span>
                  <span className={`text-base font-bold tabular-nums ${idle ? 'text-gray-300' : 'text-gray-900'}`}>{count}</span>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AttentionCard;
