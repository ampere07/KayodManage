import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X as XIcon,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Users as UsersIcon,
  Clock,
  FileText,
  ArrowLeftRight,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Transaction } from '../../types';
import { getInitials, getToUser, getTransactionIcon, getUser } from '../../utils';
import { transactionsService } from '../../services';
import { useUserDetails } from '../../hooks/useUsers';
import { useJobCategories } from '../../hooks/useJobs';
import { SidebarContext } from '../Layout/Layout';
import PanelSection from '../UI/PanelSection';
import {
  KIND_ICON,
  ROLE_TONE,
  StatusBadge,
  StatusText,
  channelName,
  describe,
  kindLabel,
  partiesOf,
  peso,
  statusLabel,
  titleCase,
  txKind,
  waited,
} from '../Transactions/txPresentation';
import type { Party, TxKind } from '../Transactions/txPresentation';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  /** Kept for callers; status changes happen through the refund actions below. */
  onStatusUpdate?: (transactionId: string, status: string, type?: string) => Promise<void>;
}

const dateOf = (value?: Date | string | null) => (value ? format(new Date(value), 'MMM d, yyyy') : '');
const timeOf = (value?: Date | string | null) => (value ? format(new Date(value), 'h:mm a') : '');

/** A job's price: its budget, or for a quote-priced job the agreed quote. */
const jobPriceOf = (job: any): number => (job?.budget > 0 ? job.budget : job?.agreedPrice || 0);

type Step = { key: string; label: string; at?: Date | string | null; note?: string; tone: string };

/** What happened, in order: when it started, when a fee is due, and how (or whether) it ended. */
const timelineOf = (tx: Transaction, kind: TxKind): Step[] => {
  const startLabel = { fee: 'Charged', topup: 'Top-up started', cashout: 'Cash-out requested', refund: 'Refund requested', other: 'Created' }[kind];
  const steps: Step[] = [{ key: 'start', label: startLabel, at: tx.createdAt, tone: 'bg-gray-400' }];
  // A fee still owed shows its due date: upcoming, or red once it has passed.
  if (kind === 'fee' && tx.status === 'pending' && tx.dueDate) {
    const overdue = new Date(tx.dueDate) < new Date();
    steps.push({ key: 'due', label: overdue ? 'Was due' : 'Due', at: tx.dueDate, tone: overdue ? 'bg-red-500' : 'bg-gray-400' });
  }
  let end: Step;
  if (tx.status === 'pending') {
    end = { key: 'end', label: kind === 'refund' ? 'Waiting for a decision' : kind === 'cashout' ? 'Waiting to be paid out' : kind === 'topup' ? 'Waiting on Xendit' : 'Waiting to be collected', note: `for ${waited(tx.createdAt)} so far`, tone: 'bg-amber-500' };
  } else if (tx.status === 'completed') {
    end = { key: 'end', label: statusLabel(kind, 'completed'), at: tx.completedAt || tx.updatedAt, tone: 'bg-emerald-500' };
  } else if (tx.status === 'failed') {
    end = { key: 'end', label: statusLabel(kind, 'failed'), at: tx.failedAt || tx.updatedAt, note: tx.failureReason, tone: 'bg-red-500' };
  } else {
    end = { key: 'end', label: statusLabel(kind, tx.status), at: tx.updatedAt, tone: 'bg-gray-400' };
  }
  // Dated steps in date order; one still waiting stays last.
  if (!end.at) return [...steps, end];
  return [...steps, end].sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
};

type FlowEnd = { title: string; sub?: string };

/**
 * Where the money comes from and where it goes. A refund moves money from the
 * provider's incoming funds to the client's available balance (approveRefund);
 * a fee is paid by whoever the record is from — the provider, or the client
 * for an ASAP priority fee.
 */
const flowOf = (tx: Transaction, kind: TxKind, parties: Party[]): { from: FlowEnd; to: FlowEnd } => {
  const m = tx.metadata || {};
  const nameOf = (role: Party['role']) => parties.find((p) => p.role === role)?.name;
  const from = (getUser(tx) as { name?: string } | undefined)?.name;
  const to = (getToUser(tx) as { name?: string } | undefined)?.name;
  switch (kind) {
    case 'fee':
      return { from: { title: from || nameOf('Provider') || 'Not recorded', sub: channelName(tx.paymentMethod || 'wallet') }, to: { title: 'Kayod', sub: 'platform fee' } };
    case 'topup':
      return { from: { title: channelName(tx.paymentMethod), sub: 'through Xendit' }, to: { title: from || to || 'Not recorded', sub: 'Kayod wallet' } };
    case 'cashout':
      return { from: { title: from || 'Not recorded', sub: 'Kayod wallet' }, to: { title: channelName(m.channel || tx.paymentMethod), sub: m.accountNumber } };
    case 'refund':
      return { from: { title: nameOf('Provider') || 'Not recorded', sub: 'incoming funds' }, to: { title: nameOf('Client') || 'Not recorded', sub: 'available balance' } };
    default:
      return { from: { title: from || 'Not recorded', sub: channelName(tx.paymentMethod || 'wallet') }, to: { title: to || from || 'Not recorded' } };
  }
};

const Fact: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <>
    <dt className="text-[11px] text-gray-500 pt-px">{label}</dt>
    <dd className={`text-xs text-gray-900 min-w-0 break-words ${mono ? 'font-mono' : 'font-medium'}`}>{children}</dd>
  </>
);

const PersonCard: React.FC<{ party: Party; wallet?: { label: string; value: string } }> = ({ party, wallet }) => {
  const person = party.person;
  const avatarTone = party.role === 'Provider' ? 'bg-indigo-50 text-indigo-600' : party.role === 'Client' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600';
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white border border-gray-100 px-3 py-2.5 min-w-0" data-testid={`transaction-party-${party.role.toLowerCase()}`}>
      {person?.profileImage ? (
        <img src={person.profileImage} alt="" className="h-10 w-10 rounded-full object-cover border border-gray-100 flex-shrink-0" />
      ) : (
        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${avatarTone}`}>
          <span className="text-sm font-bold">{getInitials(party.name || '?')}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-[9px] font-black uppercase tracking-wider ${ROLE_TONE[party.role]}`}>{party.role}</p>
        <p className={`text-sm font-bold truncate ${party.name ? 'text-gray-900' : 'text-gray-400'}`}>{party.name || 'Not recorded'}</p>
        {(person?.email || person?.phone) && (
          <p className="text-[11px] text-gray-500 truncate">{[person?.email, person?.phone].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      {wallet && (
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-gray-500">{wallet.label}</p>
          <p className="text-xs font-black text-gray-900 tabular-nums">{wallet.value}</p>
        </div>
      )}
    </div>
  );
};

/**
 * The details panel for any transaction: a fee, a top-up, a cash-out, a
 * refund request (or a fee record from the Activity / Flagged pages). Amount
 * and status up top, anything that needs attention, then the standard
 * sections in who → what → when → where order: People, Payment details,
 * Timeline, Money flow. A pending refund is decided here, with a confirm step
 * that spells out which wallets move.
 */
const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({ isOpen, onClose, transaction }) => {
  const { setIsHeaderHidden } = React.useContext(SidebarContext);
  const { categories } = useJobCategories();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<null | 'approve' | 'decline'>(null);
  const [copied, setCopied] = useState(false);

  const kind: TxKind = transaction ? txKind(transaction) : 'other';
  const parties = transaction ? partiesOf(transaction, kind) : [];
  const isPendingRefund = kind === 'refund' && transaction?.status === 'pending';

  // A refund moves money between the client's and the provider's wallets, so
  // the decision shows both balances first.
  const clientId = isPendingRefund ? parties[0]?.person?._id : undefined;
  const providerId = isPendingRefund ? parties[1]?.person?._id : undefined;
  const { data: clientDetails } = useUserDetails(clientId, isOpen && isPendingRefund);
  const { data: providerDetails } = useUserDetails(providerId, isOpen && isPendingRefund);

  // Hooks run before any early return (React needs the same order every render).
  useEffect(() => {
    setIsHeaderHidden?.(isOpen);
    return () => setIsHeaderHidden?.(false);
  }, [isOpen, setIsHeaderHidden]);

  useEffect(() => {
    setConfirming(null);
    setCopied(false);
  }, [transaction?._id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  const approveMutation = useMutation({
    mutationFn: () => transactionsService.approveRefund(transaction!._id),
    onSuccess: () => {
      toast.success('Refund approved');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to approve refund');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => transactionsService.declineRefund(transaction!._id),
    onSuccess: () => {
      toast.success('Refund request declined');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to decline refund');
    },
  });
  const busy = approveMutation.isPending || declineMutation.isPending;

  // Escape steps back out of a confirmation first, then closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      if (confirming) setConfirming(null);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, confirming, busy, onClose]);

  if (!isOpen || !transaction) return null;

  const tx = transaction;
  const job = (tx.job || tx.jobId) as any;
  const info = describe(tx, kind);
  const steps = timelineOf(tx, kind);
  const flow = flowOf(tx, kind, parties);
  const now = new Date();
  const jobPrice = jobPriceOf(job);
  const share = (kind === 'fee' || kind === 'refund') && jobPrice > 0 ? Math.round((tx.amount / jobPrice) * 100) : null;
  const reason: string | undefined = kind === 'refund' ? tx.metadata?.reason : undefined;
  const isOverdueFee = kind === 'fee' && tx.status === 'pending' && Boolean(tx.dueDate) && new Date(tx.dueDate!) < now;
  const failedWithReason = tx.status === 'failed' && kind !== 'refund' && Boolean(tx.failureReason);
  const isFeeRecord = tx.transactionType === 'fee_record';
  const service = job ? (job.professionName || job.categoryName || job.category || '') : '';
  const client = parties.find((p) => p.role === 'Client');
  const provider = parties.find((p) => p.role === 'Provider');

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(tx._id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the ID');
    }
  };

  // Refund decision: what approving does to each wallet (approveRefund adds the
  // amount to the client's available balance and takes it from the provider's
  // incoming funds, which can go below zero).
  const clientAvailable = clientDetails?.wallet?.availableBalance;
  const providerIncoming = providerDetails?.wallet?.balance;
  const providerAfter = providerIncoming !== undefined ? providerIncoming - tx.amount : undefined;
  const walletOf = (party: Party) => {
    if (!isPendingRefund) return undefined;
    if (party.role === 'Client' && clientAvailable !== undefined) return { label: 'Available', value: peso(clientAvailable) };
    if (party.role === 'Provider' && providerIncoming !== undefined) return { label: 'Incoming', value: peso(providerIncoming) };
    return undefined;
  };

  const KindIcon = KIND_ICON[kind].icon;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/50 z-[100] transition-opacity" onClick={() => !busy && onClose()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${kindLabel(tx, kind)} details`}
        data-testid="transaction-panel"
        className="fixed right-0 top-0 h-full w-full md:w-[520px] bg-white z-[101] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{kindLabel(tx, kind)}</h2>
            <button
              type="button"
              onClick={copyId}
              data-testid="transaction-copy-id"
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600"
              title="Copy the full transaction ID"
            >
              <span className="font-mono">ID {tx._id.slice(-8).toUpperCase()}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied && <span className="text-emerald-600">Copied</span>}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Summary: amount, what it is, and where it stands */}
        <div className="flex-shrink-0 px-4 md:px-6 py-5 border-b border-gray-100" data-testid="transaction-summary">
          <div className="flex items-start gap-4">
            {kind === 'fee' ? (
              <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {getTransactionIcon(tx, categories)}
              </div>
            ) : (
              <div className={`h-12 w-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${KIND_ICON[kind].tile}`}>
                <KindIcon className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-black text-gray-900 tabular-nums leading-tight">{peso(tx.amount)}</p>
              <p className="text-sm text-gray-600 truncate" title={info.title}>{info.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <StatusBadge tx={tx} kind={kind} large />
              <StatusText tx={tx} kind={kind} className="text-[11px]" />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* What needs attention, first */}
          {(isPendingRefund || isOverdueFee || failedWithReason) && (
            <div className="px-5 md:px-6 py-5 space-y-3 border-b border-gray-100">
              {isPendingRefund && (
                <div className="flex items-start gap-2 p-3 border rounded-lg bg-amber-50 border-amber-200" data-testid="transaction-banner">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div className="min-w-0 text-xs">
                    <p className="font-bold text-amber-800">Waiting for your decision · requested {waited(tx.createdAt)} ago</p>
                    {reason && <p className="mt-0.5 text-amber-900">“{reason}”</p>}
                  </div>
                </div>
              )}
              {isOverdueFee && (
                <div className="flex items-start gap-2 p-3 border rounded-lg bg-red-50 border-red-200 text-xs" data-testid="transaction-banner">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                  <p className="font-bold text-red-700">Overdue · was due {dateOf(tx.dueDate)}</p>
                </div>
              )}
              {failedWithReason && (
                <div className="flex items-start gap-2 p-3 border rounded-lg bg-red-50 border-red-200 text-xs" data-testid="transaction-banner">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                  <p className="text-red-700"><span className="font-bold">Failed:</span> {tx.failureReason}</p>
                </div>
              )}
            </div>
          )}

          {/* Who */}
          <PanelSection
            icon={UsersIcon}
            label={parties.length > 1 ? 'People' : 'Account'}
            description={{
              fee: "Who did the job and who posted it",
              refund: "Who's asking, and who pays it back",
              topup: "Whose wallet this tops up",
              cashout: "Whose wallet this pays out from",
              other: "Who's involved",
            }[kind]}
            testId="transaction-people"
          >
            <div className="space-y-2">
              {parties.map((party) => <PersonCard key={party.role} party={party} wallet={walletOf(party)} />)}
            </div>
          </PanelSection>

          {/* What */}
          <PanelSection
            icon={FileText}
            label="Payment details"
            description={{
              fee: "What the fee is and the job it's on",
              refund: "What's being refunded and why",
              topup: "What was added to the wallet",
              cashout: "What's being taken out",
              other: "What this transaction is",
            }[kind]}
            testId="transaction-details"
          >
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2">
              <Fact label="Amount">
                {peso(tx.amount)}
                {share !== null && <span className="font-normal text-gray-500"> · {share}% of the job price</span>}
              </Fact>
              {reason && !isPendingRefund && <Fact label="Reason">“{reason}”</Fact>}
              {kind === 'fee' && tx.dueDate && <Fact label="Due">{dateOf(tx.dueDate)}</Fact>}
              {isFeeRecord && typeof tx.remindersSent === 'number' && <Fact label="Reminders">{tx.remindersSent} sent</Fact>}
              {isFeeRecord && tx.penaltyApplied !== undefined && <Fact label="Penalty">{tx.penaltyApplied ? 'Applied' : 'None'}</Fact>}
              {kind === 'other' && tx.description && <Fact label="Description">{tx.description}</Fact>}
              {tx.xenditId && <Fact label="Xendit ref." mono>{tx.xenditId}</Fact>}
              <Fact label="Transaction ID" mono>{tx._id}</Fact>
            </dl>

            {/* The job the money belongs to */}
            {job && (job.title || job._id) && (
              <div className="mt-3 rounded-lg border border-gray-100 px-3 py-2.5 min-w-0" data-testid="transaction-job">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">For job</p>
                <p className="text-sm font-bold text-gray-900 truncate">{job.title || 'Untitled job'}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {[service && !/^[a-fA-F0-9]{24}$/.test(service) ? service : null, jobPrice > 0 ? `${peso(jobPrice)} job` : null].filter(Boolean).join(' · ') || 'No price recorded'}
                </p>
                {job._id && <p className="text-[10px] font-mono text-gray-400 truncate">{job._id}</p>}
              </div>
            )}
          </PanelSection>

          {/* When */}
          <PanelSection icon={Clock} label="Timeline" description="What happened and what's next" testId="transaction-timeline">
            <ol className="relative space-y-3">
              {steps.map((step, index) => {
                const upcoming = Boolean(step.at) && new Date(step.at!).getTime() > now.getTime();
                return (
                  <li key={step.key} className="relative flex gap-3" data-testid={`transaction-when-${step.key}`}>
                    {index < steps.length - 1 && <span className="absolute left-[4px] top-3 bottom-[-12px] w-px bg-gray-200" aria-hidden="true" />}
                    <span className={`relative mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white ${upcoming ? 'border-2 border-dashed border-blue-400 bg-white' : step.tone}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${upcoming ? 'text-blue-700' : 'text-gray-900'}`}>
                        {step.label}
                        {upcoming && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500">upcoming</span>}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {step.at ? `${dateOf(step.at)} · ${timeOf(step.at)} (${formatDistanceToNowStrict(new Date(step.at), { addSuffix: true })})` : step.note}
                      </p>
                      {step.at && step.note && <p className="text-[11px] text-gray-500">{step.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </PanelSection>

          {/* Where */}
          <PanelSection
            icon={ArrowLeftRight}
            label="Money flow"
            description={{
              fee: "Where the fee is paid from",
              refund: "Which wallets a refund moves between",
              topup: "Where the money came from",
              cashout: "Where the money is going",
              other: "Where the money moved",
            }[kind]}
            testId="transaction-flow"
            last
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              {([['From', flow.from], ['To', flow.to]] as const).map(([side, end], index) => (
                <React.Fragment key={side}>
                  {index === 1 && <ArrowRight className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                  <div className="rounded-lg border border-gray-100 px-3 py-2.5 min-w-0" data-testid={`transaction-flow-${side.toLowerCase()}`}>
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{side}</p>
                    <p className="text-sm font-bold text-gray-900 truncate" title={end.title}>{end.title}</p>
                    {end.sub && <p className="text-[11px] text-gray-500 truncate">{end.sub}</p>}
                  </div>
                </React.Fragment>
              ))}
            </div>
            {/* The account number is on the To card; the name and how it's sent go here. */}
            {kind === 'cashout' && (
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 mt-3">
                {tx.metadata?.accountName && <Fact label="Account name">{tx.metadata.accountName}</Fact>}
                <Fact label="Sent as">{titleCase(channelName(tx.paymentMethod || 'bank_transfer'))}</Fact>
              </dl>
            )}
            {/* Only said where the effect is known: a refund moves nothing until approved, and nothing when declined. */}
            {kind === 'refund' && tx.status !== 'completed' && (
              <p className="mt-3 text-[11px] text-gray-500">
                {isPendingRefund ? 'Nothing moves until the refund is approved.' : 'Declined, so no money moved.'}
              </p>
            )}
          </PanelSection>
        </div>

        {/* Footer: a pending refund is decided here; everything else just closes. */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 md:px-6 py-4">
          {isPendingRefund && confirming ? (
            <div data-testid="refund-confirm">
              <p className="text-sm font-bold text-gray-900">
                {confirming === 'approve' ? `Approve this ${peso(tx.amount)} refund?` : 'Decline this refund request?'}
              </p>
              {confirming === 'approve' ? (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  <li>
                    <span className="font-semibold text-gray-900">{peso(tx.amount)}</span> goes to {client?.name || 'the client'}'s available balance
                    {clientAvailable !== undefined && <> ({peso(clientAvailable)} → {peso(clientAvailable + tx.amount)})</>}.
                  </li>
                  <li>
                    The same comes out of {provider?.name || 'the provider'}'s incoming funds
                    {providerIncoming !== undefined && providerAfter !== undefined && <> ({peso(providerIncoming)} → {peso(providerAfter)})</>}.
                  </li>
                  {providerAfter !== undefined && providerAfter < 0 && (
                    <li className="flex items-start gap-1.5 text-red-600 font-semibold" data-testid="refund-negative-warning">
                      <AlertTriangle className="h-3.5 w-3.5 mt-px flex-shrink-0" />
                      This leaves {provider?.name || 'the provider'} {peso(Math.abs(providerAfter))} below zero.
                    </li>
                  )}
                  <li>This can't be undone from the portal.</li>
                </ul>
              ) : (
                <p className="mt-2 text-xs text-gray-600">
                  The request is marked declined and no money moves. {client?.name || 'The client'} keeps nothing back from this request.
                </p>
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="refund-back"
                  onClick={() => setConfirming(null)}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  data-testid="refund-confirm-button"
                  onClick={() => (confirming === 'approve' ? approveMutation.mutate() : declineMutation.mutate())}
                  disabled={busy}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60 ${confirming === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {confirming === 'approve' ? `Approve ${peso(tx.amount)}` : 'Decline request'}
                </button>
              </div>
            </div>
          ) : isPendingRefund ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="refund-decline"
                onClick={() => setConfirming('decline')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                data-testid="refund-approve"
                onClick={() => setConfirming('approve')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                Approve refund
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default TransactionDetailsModal;
