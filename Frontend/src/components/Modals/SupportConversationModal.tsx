import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Eye, ExternalLink, Lock, X } from 'lucide-react';
import type { ChatSupport, Message } from '../../types/support.types';

/**
 * A support ticket's conversation, read-only.
 *
 * Opened from a user's activity history so an admin can read what was said on
 * a ticket — including a closed one — without leaving the user they are
 * looking at. Deliberately view-only: replying, accepting, resolving and
 * dispute rulings all live in the Support Center, which owns the socket rooms
 * and optimistic-send logic that make those actions correct. Duplicating that
 * here would mean two implementations of the same workflow drifting apart.
 * "Open Support Center" hands this same ticket over to it by id, so the
 * conversation opens there rather than dropping the admin on the ticket list.
 *
 * Who may read which ticket is settled by the server: a superadmin can open
 * any ticket, and another admin gets a 404 for one that is not theirs. Nothing
 * is gated again here, so the two can never disagree.
 */

interface SupportConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ChatSupport | null;
}

const stamp = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : '—';

const STATUS_TONE: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200'
};

const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200'
};

const Chip: React.FC<{ label: string; tone?: string }> = ({ label, tone }) => (
  <span
    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border ${
      tone || 'bg-gray-100 text-gray-600 border-gray-200'
    }`}
  >
    {label}
  </span>
);

const MetaRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="text-xs font-medium text-gray-900 text-right break-words">{value}</p>
  </div>
);

const MessageBubble: React.FC<{ entry: Message }> = ({ entry }) => {
  const fromAdmin = entry.senderType === 'Admin';

  // An internal note never reached the customer. It reads as a side annotation
  // rather than a chat bubble so it can never be mistaken for something the
  // user was told.
  if (entry.isInternal) {
    return (
      <li className="flex justify-center">
        <div className="max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Internal note · not shown to the user
            </span>
          </div>
          <p className="text-xs text-amber-900 whitespace-pre-wrap break-words">{entry.message}</p>
          <p className="text-[10px] text-amber-600 mt-1">
            {entry.senderName || 'Admin'} · {stamp(entry.timestamp)}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl px-3 py-2 ${
            fromAdmin
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          }`}
        >
          {entry.imageUrl && (
            <img
              src={entry.imageUrl}
              alt="Attachment"
              className="rounded-lg mb-1.5 max-h-56 w-auto object-cover"
            />
          )}
          {entry.message && (
            <p className="text-sm whitespace-pre-wrap break-words">{entry.message}</p>
          )}
        </div>
        <p
          className={`text-[10px] text-gray-400 mt-1 ${fromAdmin ? 'text-right' : 'text-left'}`}
        >
          {entry.senderName || (fromAdmin ? 'Admin' : 'User')} · {stamp(entry.timestamp)}
        </p>
      </div>
    </li>
  );
};

const SupportConversationModal: React.FC<SupportConversationModalProps> = ({
  isOpen,
  onClose,
  ticket
}) => {
  const navigate = useNavigate();

  // Escape closes the viewer, matching every other panel in the admin.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !ticket) return null;

  const messages = ticket.messages || [];
  const statusLabel = ticket.displayStatus || ticket.status;
  const resolution = (ticket.statusHistory || [])
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[100] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full md:w-[560px] bg-white z-[101] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 break-words">{ticket.subject}</h2>
              <p className="text-xs font-medium text-gray-500 mt-0.5">
                {ticket.ticketId ? `Ticket ${ticket.ticketId}` : 'Support ticket'}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close conversation"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <Chip label={statusLabel} tone={STATUS_TONE[statusLabel]} />
            {ticket.priority && (
              <Chip label={ticket.priority} tone={PRIORITY_TONE[ticket.priority]} />
            )}
            {ticket.category && <Chip label={ticket.category} />}
          </div>
        </div>

        {/* Read-only notice. Says where the actions live rather than showing
            disabled buttons that explain nothing. */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 md:px-6 py-2 bg-gray-50 border-b border-gray-200">
          <Eye className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <p className="text-[11px] font-medium text-gray-500 flex-1">
            Viewing only. Reply and resolve from the Support Center.
          </p>
          <button
            onClick={() => navigate(`/support?id=${ticket._id}`)}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            Open Support Center
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">
              No messages were exchanged on this ticket.
            </p>
          ) : (
            <ul className="space-y-3">
              {messages.map((entry, index) => (
                <MessageBubble key={entry._id || `${entry.timestamp}-${index}`} entry={entry} />
              ))}
            </ul>
          )}
        </div>

        {/* Ticket facts */}
        <div className="flex-shrink-0 border-t border-gray-200 px-4 md:px-6 py-4 space-y-2 bg-gray-50 max-h-[40%] overflow-y-auto">
          <MetaRow label="Opened" value={stamp(ticket.createdAt)} />
          {ticket.closedAt && <MetaRow label="Closed" value={stamp(ticket.closedAt)} />}
          <MetaRow label="Messages" value={String(messages.length)} />
          {ticket.acceptedByName && (
            <MetaRow label="Accepted by" value={ticket.acceptedByName} />
          )}
          {ticket.assignedToName && (
            <MetaRow label="Assigned to" value={ticket.assignedToName} />
          )}
          {resolution && (
            <MetaRow
              label={resolution.status === 'reopened' ? 'Reopened by' : 'Resolved by'}
              value={
                <>
                  {resolution.performedByName || 'Admin'} · {stamp(resolution.timestamp)}
                  {resolution.reason && (
                    <span className="block text-gray-500 font-normal mt-0.5">
                      “{resolution.reason}”
                    </span>
                  )}
                </>
              }
            />
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default SupportConversationModal;
