import React from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Hourglass, Receipt, RotateCcw, XCircle, CreditCard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import type { Transaction } from '../../types';
import { formatPHPCurrency, getToUser, getUser, isOverdue } from '../../utils';

// How a transaction reads, wherever it is shown: the Transactions list and the
// transaction details panel use these so a row and its panel always say the
// same thing ("Awaiting decision", "Paid out Oct 14", "Waiting 4 days").

export type TxKind = 'fee' | 'topup' | 'cashout' | 'refund' | 'other';

export const txKind = (tx: Transaction): TxKind => {
  const type = (tx.type || '').toLowerCase();
  if (tx.transactionType === 'fee_record' || type === 'platform_fee' || type === 'fee_payment') return 'fee';
  if (type === 'xendit_topup' || type === 'wallet_topup' || type === 'topup') return 'topup';
  if (type === 'withdrawal') return 'cashout';
  if (type.includes('refund')) return 'refund';
  return 'other';
};

export const KIND_TITLE: Record<TxKind, string> = {
  fee: 'Platform fee',
  topup: 'Wallet top-up',
  cashout: 'Cash-out',
  refund: 'Refund request',
  other: 'Transaction',
};

/** What a status is called for each kind of money. */
const STATUS_WORDS: Record<TxKind, Record<string, string>> = {
  fee: { completed: 'Collected' },
  topup: { completed: 'Credited' },
  cashout: { completed: 'Paid out' },
  refund: { pending: 'Awaiting decision', completed: 'Approved', failed: 'Declined' },
  other: {},
};

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const statusLabel = (kind: TxKind, status: string) => STATUS_WORDS[kind][status] || titleCase(status);

// Badge colours by status; the list's counters use the same tones.
const BADGE: Record<string, { badge: string; dot: string }> = {
  completed: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pending: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  failed: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};
export const badgeOf = (status: string) => BADGE[status] || { badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };

export const StatusBadge: React.FC<{ tx: Transaction; kind: TxKind; small?: boolean; large?: boolean }> = ({ tx, kind, small, large }) => {
  const look = badgeOf(tx.status);
  const size = small ? 'px-2 py-0.5 text-[9px] tracking-tight' : large ? 'px-3 py-1 text-[11px] tracking-wider' : 'px-2.5 py-1 text-[10px] tracking-wider';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase whitespace-nowrap ${size} ${look.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      {statusLabel(kind, tx.status)}
    </span>
  );
};

// Payment channels as their brands write them (Xendit sends GCASH, PAYMAYA…).
const CHANNELS: Record<string, string> = {
  GCASH: 'GCash', PAYMAYA: 'Maya', MAYA: 'Maya', GRABPAY: 'GrabPay', SHOPEEPAY: 'ShopeePay', CARD: 'card',
  BPI: 'BPI', BDO: 'BDO', BPI_DIRECT_DEBIT: 'BPI Direct Debit', BDO_DIRECT_DEBIT: 'BDO Direct Debit', XENDIT: 'Xendit',
  WALLET: 'Kayod wallet', BANK_TRANSFER: 'bank transfer',
};
export const channelName = (raw?: string) => {
  const key = String(raw || 'xendit').toUpperCase().replace(/\s+/g, '_');
  return CHANNELS[key] || titleCase(String(raw).toLowerCase());
};

export const peso = (amount: number) => formatPHPCurrency(amount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace('PHP', '₱');
export const day = (value?: Date | string | null) => (value ? format(new Date(value), 'MMM d') : '');
export const waited = (value: Date | string) => formatDistanceToNowStrict(new Date(value));
export const cleanTitle = (text = '') => text.replace(/^ASAP\s*/i, '').replace(/priority fee for job:\s*/i, '').replace(/^Platform fee for job:\s*/i, '').replace(/^Refund request for job:\s*/i, '');

/** The one line under a status: what it is waiting on, or when it settled. */
export const statusLine = (tx: Transaction, kind: TxKind): { text: string; icon: LucideIcon; tone: string } => {
  switch (tx.status) {
    case 'pending':
      if (kind === 'fee') {
        return isOverdue(tx) ? { text: 'Overdue', icon: AlertTriangle, tone: 'text-red-600 font-semibold' } : { text: 'Not collected yet', icon: Hourglass, tone: 'text-gray-500' };
      }
      if (kind === 'topup') return { text: `Waiting on Xendit · ${waited(tx.createdAt)}`, icon: Hourglass, tone: 'text-gray-500' };
      return { text: `Waiting ${waited(tx.createdAt)}`, icon: Clock, tone: 'text-amber-600' };
    case 'completed':
      return { text: `${statusLabel(kind, 'completed')} ${day(tx.completedAt || tx.updatedAt)}`.trim(), icon: CheckCircle2, tone: 'text-gray-500' };
    case 'failed':
      if (kind === 'refund') return { text: `Declined ${day(tx.failedAt || tx.updatedAt)}`.trim(), icon: XCircle, tone: 'text-gray-500' };
      return { text: tx.failureReason || `Failed ${day(tx.failedAt || tx.updatedAt)}`.trim(), icon: XCircle, tone: 'text-gray-500' };
    case 'expired':
      return { text: 'Never paid', icon: Hourglass, tone: 'text-gray-500' };
    default:
      return { text: titleCase(tx.status), icon: XCircle, tone: 'text-gray-500' };
  }
};

export const StatusText: React.FC<{ tx: Transaction; kind: TxKind; className?: string }> = ({ tx, kind, className = '' }) => {
  const line = statusLine(tx, kind);
  const Icon = line.icon;
  return (
    <span className={`flex items-center gap-1 min-w-0 ${line.tone} ${className}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{line.text}</span>
    </span>
  );
};

type PersonRef = { _id?: string; name?: string; email?: string; phone?: string; location?: string; profileImage?: string; userType?: string };
export type Party = { role: 'Client' | 'Provider' | 'User'; name?: string; sub?: string; person?: PersonRef };

/** Who a transaction involves, each labelled with their role. */
export const partiesOf = (tx: Transaction, kind: TxKind): Party[] => {
  const from = getUser(tx) as PersonRef | undefined;
  const to = getToUser(tx) as PersonRef | undefined;
  const job = (tx.job || tx.jobId) as any;
  const roleOf = (u?: PersonRef): Party['role'] => (u?.userType === 'provider' ? 'Provider' : u?.userType === 'client' ? 'Client' : 'User');
  if (kind === 'fee') {
    const provider = job?.assignedToId || (from?.userType !== 'client' ? from : undefined);
    const client = job?.userId || (from?.userType === 'client' ? from : undefined);
    return [
      { role: 'Provider', name: provider?.name, person: provider },
      { role: 'Client', name: client?.name, person: client },
    ];
  }
  if (kind === 'refund') {
    const provider = to || job?.assignedToId;
    return [
      { role: 'Client', name: from?.name, person: from },
      { role: 'Provider', name: provider?.name, person: provider },
    ];
  }
  const person = from || to;
  return [{ role: roleOf(person), name: person?.name, sub: person?.email || person?.phone, person }];
};

export const ROLE_TONE: Record<Party['role'], string> = { Client: 'text-purple-600', Provider: 'text-indigo-600', User: 'text-gray-500' };

export const PartyLine: React.FC<{ party: Party; small?: boolean }> = ({ party, small }) => (
  <div className="flex items-baseline gap-2 min-w-0" title={party.name ? `${party.role}: ${party.name}` : undefined}>
    <span className={`flex-shrink-0 font-black uppercase tracking-wider ${small ? 'w-[50px] text-[8px]' : 'w-[60px] text-[9px]'} ${ROLE_TONE[party.role]}`}>{party.role}</span>
    <span className={`truncate ${small ? 'text-[11px]' : 'text-xs'} ${party.name ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{party.name || 'Not recorded'}</span>
  </div>
);

/** What kind of money this is, the line above a title. */
export const kindLabel = (tx: Transaction, kind: TxKind) =>
  kind === 'fee' && /^ASAP/i.test(tx.description || '') ? 'ASAP priority fee' : KIND_TITLE[kind];

/** A transaction's title and the line under it. */
export const describe = (tx: Transaction, kind: TxKind): { title: string; detail: string } => {
  const job = (tx.job || tx.jobId) as any;
  const id = `ID ${tx._id.slice(-8).toUpperCase()}`;
  switch (kind) {
    case 'topup':
      return { title: `Top-up via ${channelName(tx.paymentMethod)}`, detail: tx.xenditId || id };
    case 'cashout': {
      const m = tx.metadata || {};
      return { title: tx.description || 'Cash-out', detail: [m.accountName, m.accountNumber].filter(Boolean).join(' · ') || id };
    }
    case 'refund':
      return { title: job?.title || cleanTitle(tx.description) || 'Refund request', detail: tx.metadata?.reason ? `“${tx.metadata.reason}”` : id };
    default:
      return { title: job?.title || cleanTitle(tx.description) || KIND_TITLE[kind], detail: id };
  }
};

/** How the money moves, under an amount. */
export const methodOf = (tx: Transaction, kind: TxKind) => {
  if (kind === 'cashout') return String(tx.metadata?.channel || tx.paymentMethod || 'bank').replace(/_/g, ' ');
  return String(tx.paymentMethod || 'wallet').replace(/_/g, ' ');
};

/** The tinted icon tile for each kind (fees show their job's icon instead). */
export const KIND_ICON: Record<TxKind, { icon: LucideIcon; tile: string }> = {
  fee: { icon: Receipt, tile: 'bg-amber-50 text-amber-600 border-amber-100' },
  topup: { icon: ArrowDownLeft, tile: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  cashout: { icon: ArrowUpRight, tile: 'bg-orange-50 text-orange-600 border-orange-100' },
  refund: { icon: RotateCcw, tile: 'bg-rose-50 text-rose-600 border-rose-100' },
  other: { icon: CreditCard, tile: 'bg-gray-50 text-gray-500 border-gray-100' },
};
