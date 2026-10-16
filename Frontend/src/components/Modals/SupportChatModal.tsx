import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  X,
  CheckCircle,
  RefreshCw,
  MessageSquare,
  MoreVertical,
  ArrowLeft,
  Send,
  Eye,
  Briefcase,
  AlertTriangle,
  Tag,
  MapPin,
  Calendar,
  Info,
} from "lucide-react";
import { getStatusBadge } from "../../utils";
import UserTypeBadge from "../UI/UserTypeBadge";
import { useAuth } from "../../context/AuthContext";
import type {
  DisputeFinding,
  FaultParty,
  FindingReason,
} from "../../types/jobs.types";
import { jobsService, usersService } from "../../services";
import JobDetailsModal from "./JobDetailsModal";

interface Message {
  _id?: string;
  senderType: "Admin" | "User";
  senderId?: string;
  senderName?: string;
  message: string;
  imageUrl?: string;
  timestamp: string;
  isInternal?: boolean;
}

interface ChatSupport {
  _id: string;
  ticketId?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userType?: string;
  userProfileImage?: string;
  subject: string;
  category: string;
  description?: string;
  status: "open" | "closed";
  priority: "urgent" | "high" | "medium" | "low";
  metadata?: any;
  jobDetailsSnapshot?: any;
  messages?: Message[];
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  unreadCount?: number;
  assignedTo?: string;
  assignedToName?: string;
  acceptedBy?: string;
  acceptedByName?: string;
  acceptedAt?: string;
  statusHistory?: Array<{
    status: "resolved" | "reopened";
    performedBy?: string;
    performedByName?: string;
    timestamp: string;
    reason?: string;
  }>;
}

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChat: ChatSupport | null;
  message: string;
  setMessage: (message: string) => void;
  sendMessage: () => void;
  sendingMessage: boolean;
  // `reason` carries the required resolution note on the "close" action.
  // Returns a promise in practice — resolving awaits it so a failed close is
  // reported instead of silently leaving the ticket open.
  handleChatAction: (
    chatSupportId: string,
    action: string,
    reason?: string,
  ) => void | Promise<void>;
  handleAcceptTicket: (chatSupportId: string) => Promise<void> | void;
  onResolveDispute?: (
    jobId: string,
    outcome: "pay_provider" | "refund_client" | "rebook" | "no_show_payout",
    note?: string,
    rebookDeadlineAt?: string,
    finding?: DisputeFinding,
  ) => Promise<void>;
  /** Admin-only note on the thread — never rendered to the customer. */
  onAddInternalNote?: (chatSupportId: string, note: string) => Promise<void>;
  /** The other party's thread of the same dispute (cross-linked by metadata.jobId). */
  counterpartChat?: ChatSupport | null;
  onSwitchChat?: (chat: ChatSupport) => void;
}

const DETAIL_ICONS: { [key: string]: any } = {
  'Job': Briefcase,
  'Job ID': Tag,
  'Reference': Tag,
  'Location': MapPin,
  'Needed On': Calendar,
  'Date': Calendar,
  'Ticket ID': Tag,
  'Subject': MessageSquare,
  'Category': Info,
  'Resolved': CheckCircle,
  'Resolved By': Eye,
  'Total Messages': MessageSquare,
};

/**
 * Dispute and job tickets end their opening message with a bare
 * "Job ID: <24-hex>" line. A raw id is unreadable and unusable — it is lifted
 * out of the body so the bubble can offer a "View Job Details" button instead.
 */
const JOB_ID_LINE = /^[ \t]*Job\s*ID[:：][ \t]*([0-9a-fA-F]{24})[ \t]*$/m;

/**
 * The opening message raiseDispute posts, e.g.
 *   "The client raised a dispute on this job. Reason: work incomplete"
 * It is the single most important line in the thread, yet as plain body text it
 * read exactly like any other chat message. Split so it can be presented as the
 * filing it is, with the reason set apart from the boilerplate.
 */
const DISPUTE_OPENER =
  /^\s*(I|The client|The provider)\s+(raised a dispute on this job|reported you in a dispute on this job)\.\s*Reason:\s*([\s\S]*)$/i;

const RAISER_LABEL: Record<string, string> = {
  i: "Dispute raised by this user",
  "the client": "Dispute raised by the client",
  "the provider": "Dispute raised by the provider",
};

/**
 * The reported party's thread — raiseDispute opens it by telling that user what
 * they were reported for. Labelled from the admin's vantage ("this user was
 * reported"), not the user's ("you were reported"), so the thread reads
 * correctly in the review queue. The "raised by …" wording still covers the
 * raiser's own thread and disputes filed before the two sides were worded apart.
 */
const REPORTED_LABEL: Record<string, string> = {
  "the client": "This user was reported by the client",
  "the provider": "This user was reported by the provider",
};

const disputeLabel = (raiser: string, verb: string) => {
  const key = raiser.toLowerCase();
  return /^reported/i.test(verb)
    ? REPORTED_LABEL[key] || "This user was reported"
    : RAISER_LABEL[key] || "Dispute raised";
};

/**
 * The opener raiseDispute posts on the thread of the party who did NOT file.
 * That thread never quotes the complaint — one party's account does not belong
 * in the other's support thread as if it were settled — so the complaint
 * reaches this side of the review through metadata.disputeReason instead.
 */
const DISPUTE_NOTICE =
  /^\s*You have been involved in a job dispute\.\s*([\s\S]*)$/i;

const DISPUTE_NOTICE_LABEL = "This user was notified of the dispute";

const extractJobIdLine = (text: string) => {
  const match = text.match(JOB_ID_LINE);
  if (!match) return { text, jobId: null as string | null };
  return {
    text: text.replace(JOB_ID_LINE, '').replace(/\n{2,}$/, '').trimEnd(),
    jobId: match[1],
  };
};

function parseMessageContent(text: string) {
  if (!text) return { body: '', jobDetails: null, systemSummary: null, jobId: null, dispute: null };

  // Detect system summary (reopened ticket)
  if (text.startsWith('✓ PREVIOUS TICKET RESOLVED')) {
    const lines = text.split('\n').filter(l => l.trim());
    const entries = [];
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && !line.startsWith('✓') && !line.startsWith('─')) {
        const label = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (label && value) entries.push({ label, value });
      }
    }
    return { body: '', jobDetails: null, systemSummary: entries, jobId: null, dispute: null };
  }

  const lifted = extractJobIdLine(text);
  text = lifted.text;

  // Detect "Job Details:" block
  const jobIdx = text.indexOf('Job Details:');
  if (jobIdx === -1) {
    const opener = text.match(DISPUTE_OPENER);
    const notice = opener ? null : text.match(DISPUTE_NOTICE);
    return {
      body: text,
      jobDetails: null,
      systemSummary: null,
      jobId: lifted.jobId,
      dispute: opener
        ? {
            raisedBy: disputeLabel(opener[1], opener[2]),
            reason: opener[3].trim(),
          }
        : notice
          ? {
              raisedBy: DISPUTE_NOTICE_LABEL,
              reason: notice[1].trim(),
            }
          : null,
    };
  }

  const body = text.substring(0, jobIdx).trim();
  const detailsBlock = text.substring(jobIdx + 'Job Details:'.length).trim();
  const entries = [];

  for (const line of detailsBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const label = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      if (label && value) entries.push({ label, value });
    }
  }

  return {
    body,
    jobDetails: entries.length ? entries : null,
    systemSummary: null,
    jobId: lifted.jobId,
    dispute: null,
  };
}

const JobDetailsCard: React.FC<{ entries: Array<{label: string, value: string}>, isUser: boolean }> = ({ entries, isUser }) => (
  <div style={{ marginTop: 16 }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottom: `1px solid ${isUser ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.1)'}`,
      }}
    >
      <Briefcase size={14} color={isUser ? '#B45309' : '#6B7280'} />
      <span
        style={{
          marginLeft: 8,
          fontSize: 11,
          fontWeight: '700',
          color: isUser ? '#92400E' : '#6B7280',
          letterSpacing: 0.5,
        }}
      >
        JOB DETAILS
      </span>
    </div>
    {entries.map((entry, idx) => {
      const IconComponent = DETAIL_ICONS[entry.label] || Info;
      return (
        <div
          key={`${entry.label}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            paddingTop: 10,
            paddingBottom: 10,
            borderBottom: idx < entries.length - 1 ? `1px solid ${isUser ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)'}` : 'none',
          }}
        >
          <IconComponent
            size={15}
            color={isUser ? '#D97706' : '#9CA3AF'}
            style={{ marginTop: 1, marginRight: 10, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: isUser ? '#B45309' : '#9CA3AF', fontWeight: '600', marginBottom: 2, display: 'block' }}>
              {entry.label}
            </span>
            <span style={{ fontSize: 14, color: '#1F2937', fontWeight: '500', userSelect: 'text' }}>
              {entry.value}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

const SystemSummaryCard: React.FC<{ entries: Array<{label: string, value: string}> }> = ({ entries }) => (
  <div
    style={{
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #D1FAE5',
      backgroundColor: '#F0FDF4',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#DCFCE7',
        borderBottom: '1px solid #D1FAE5',
      }}
    >
      <CheckCircle size={16} color="#16A34A" />
      <span
        style={{
          marginLeft: 8,
          fontSize: 13,
          fontWeight: '700',
          color: '#15803D',
          letterSpacing: 0.3,
        }}
      >
        PREVIOUS TICKET RESOLVED
      </span>
    </div>
    <div style={{ paddingVertical: 4 }}>
      {entries.map((entry, idx) => {
        const IconComponent = DETAIL_ICONS[entry.label] || Info;
        return (
          <div
            key={`${entry.label}-${idx}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <IconComponent
              size={14}
              color="#6B7280"
              style={{ marginTop: 2, marginRight: 10, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>
              <span style={{ fontWeight: '600', color: '#6B7280' }}>{entry.label}: </span>
              {entry.value}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

const getInitials = (name: string): string => {
  const nameParts = name
    .trim()
    .split(" ")
    .filter((part) => part.length > 0);
  if (nameParts.length === 0) return "?";
  return nameParts[0][0].toUpperCase();
};

const formatResponseTime = (minutes: number): string => {
  const years = Math.floor(minutes / (365 * 24 * 60));
  const months = Math.floor((minutes % (365 * 24 * 60)) / (30 * 24 * 60));
  const days = Math.floor((minutes % (30 * 24 * 60)) / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = Math.floor(minutes % 60);

  const parts = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(" ");
};

const getPriorityClasses = (priority = "medium") => {
  const normalized = priority.toLowerCase();
  if (normalized === "urgent") return "bg-red-100 text-red-800";
  if (normalized === "high") return "bg-orange-100 text-orange-800";
  if (normalized === "low") return "bg-green-100 text-green-800";
  return "bg-yellow-100 text-yellow-800";
};

const formatSystemEventMessage = (message: Message) => {
  const text = message.message || "";
  const normalized = text.toLowerCase();
  const sender = message.senderName || "Support Agent";

  if (normalized.includes("reopened")) return `Ticket reopened by ${sender}`;
  if (normalized.includes("accepted")) return `Ticket accepted by ${sender}`;
  if (normalized.includes("resolved") || normalized.includes("closed")) {
    return `Ticket resolved by ${sender}`;
  }

  return text;
};

/**
 * Canned resolution notes. Resolving a ticket requires a note, and most
 * resolutions fall into one of these — picking one keeps the wording consistent
 * across admins and saves typing. Anything that doesn't fit uses
 * CUSTOM_NOTE_OPTION and gets typed out instead.
 *
 * These are written to be read BY THE CUSTOMER: the backend echoes the note
 * into the ticket as "Ticket has been resolved: <note>". Keep any new entry
 * phrased as something you would be happy to send the person who filed it.
 */
const RESOLUTION_NOTE_PRESETS = [
  "Issue resolved and confirmed with you",
  "Resolved after troubleshooting together",
  "Payment / top-up issue verified and corrected",
  "Refund processed",
  "Duplicate of an existing ticket",
  "Closed after no reply to our follow-up",
  "Referred to the team that handles this",
  "Closed as an invalid request",
];

/** Sentinel for the "write my own" choice — never a real note body. */
const CUSTOM_NOTE_OPTION = "__custom__";

/**
 * "Due by <date>" means the end of that day, not the start of it. Parsing the
 * raw yyyy-mm-dd with `new Date()` yields UTC midnight, which in UTC+8 expires
 * the deadline at 8am on the due date — cutting the provider's last day short.
 */
const endOfLocalDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

const SupportChatModal: React.FC<SupportChatModalProps> = ({
  isOpen,
  onClose,
  selectedChat,
  message,
  setMessage,
  sendMessage,
  sendingMessage,
  handleChatAction,
  handleAcceptTicket,
  onResolveDispute,
  onAddInternalNote,
  counterpartChat,
  onSwitchChat,
}) => {
  const { user } = useAuth();
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalLoading, setJobModalLoading] = useState(false);
  const [jobModalData, setJobModalData] = useState<any>(null);
  // The job behind the ticket, loaded so the Concern block can show its title
  // and description. Tickets only store a jobId (and occasionally a snapshot
  // with no description), so this has to come from the job itself.
  const [concernJob, setConcernJob] = useState<any>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [resolvingOutcome, setResolvingOutcome] = useState<string | null>(null);
  // Manual account restriction, alongside the money outcomes. The automatic
  // restriction only ever fires on a PATTERN of missed bookings; a single
  // egregious one still needs a human to be able to act on it.
  const [restrictingUser, setRestrictingUser] = useState(false);
  // Required for the rebook outcome — the client's payment stays held while the
  // work is redone, so the redo needs a date the scheduler can escalate on.
  const [rebookDeadline, setRebookDeadline] = useState("");
  // The FINDING, kept separate from the outcome. An admin can rule on the money
  // without being forced to attribute blame — an unstated finding is recorded as
  // "uncertain" and sanctions nobody, which is the honest default when a case
  // genuinely cannot be called.
  const [faultParty, setFaultParty] = useState<FaultParty>("uncertain");
  const [findingReason, setFindingReason] = useState<FindingReason>("other");
  const [internalNoteText, setInternalNoteText] = useState("");
  const [sendingInternalNote, setSendingInternalNote] = useState(false);
  // The resolution note that closes the ticket, kept separate from the dispute
  // ruling above: the outcome buttons move the money, this note ends the
  // conversation and is what both parties are told.
  const [resolutionNoteText, setResolutionNoteText] = useState("");
  // "" = nothing picked yet, CUSTOM_NOTE_OPTION = write your own, anything else
  // is one of RESOLUTION_NOTE_PRESETS used verbatim as the note.
  const [resolutionNotePreset, setResolutionNotePreset] = useState("");
  const [resolvingTicket, setResolvingTicket] = useState(false);
  const [acceptingTicket, setAcceptingTicket] = useState(false);
  const activeTicketIdRef = useRef<string | null>(null);
  const acceptRequestIdRef = useRef(0);
  const jobRequestIdRef = useRef(0);
  const disputeRequestIdRef = useRef(0);
  const noteRequestIdRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const nextTicketId = isOpen ? selectedChat?._id || null : null;
    if (activeTicketIdRef.current === nextTicketId) return;

    activeTicketIdRef.current = nextTicketId;
    acceptRequestIdRef.current += 1;
    jobRequestIdRef.current += 1;
    disputeRequestIdRef.current += 1;
    messageRefs.current = {};
    setShowMobileDetails(false);
    setJobModalOpen(false);
    setJobModalLoading(false);
    setJobModalData(null);
    setConcernJob(null);
    setDisputeNote("");
    setFaultParty("uncertain");
    setFindingReason("other");
    // Was never cleared here — switching tickets carried the previous ticket's
    // redo deadline over, and it now gates (and would be submitted with) the
    // next resolve.
    setRebookDeadline("");
    setResolutionNoteText("");
    setResolutionNotePreset("");
    setResolvingTicket(false);
    setAcceptingTicket(false);
  }, [isOpen, selectedChat?._id]);

  // Load the job behind the ticket for the Concern block. Only fires when the
  // ticket actually references one, and the ticket id is re-checked on arrival
  // so a slow response for a previous ticket cannot overwrite the current one.
  useEffect(() => {
    const jobId =
      selectedChat?.metadata?.jobId ||
      selectedChat?.jobDetailsSnapshot?.jobId ||
      selectedChat?.jobDetailsSnapshot?.["Job ID"];
    if (!isOpen || !jobId) return;

    const ticketId = selectedChat?._id;
    let cancelled = false;
    jobsService
      .getJobById(String(jobId))
      .then((data: any) => {
        if (cancelled || activeTicketIdRef.current !== ticketId) return;
        setConcernJob(data?.job || data || null);
      })
      .catch((error) => {
        // Non-fatal: the block simply falls back to the stored title.
        console.error("Failed to load job for concern summary:", error);
      });

    return () => {
      cancelled = true;
    };
    // status too: a ruling closes the ticket and settles the job, and the
    // Resolve gate below reads whether that job's dispute is still live.
  }, [isOpen, selectedChat?._id, selectedChat?.status]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Add ring/border and scale-up effect (no background change to preserve readability)
      messageElement.style.transition = "all 0.3s ease";
      messageElement.style.transform = "scale(1.05)";
      messageElement.style.boxShadow =
        "0 0 0 3px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(59, 130, 246, 0.3)";

      setTimeout(() => {
        messageElement.style.transform = "scale(1)";
        messageElement.style.boxShadow = "";
      }, 2000);
    }
  };

  if (!isOpen || !selectedChat) return null;

  const getJobIdFromSnapshot = () => {
    const snapshot = selectedChat.jobDetailsSnapshot || selectedChat.metadata;
    if (!snapshot) return null;
    return snapshot.jobId || snapshot["Job ID"] || snapshot["jobId"];
  };

  const hasJobId = getJobIdFromSnapshot() !== null;
  const isDisputeTicket = selectedChat.metadata?.kind === "dispute";
  const disputeJobId = selectedChat.metadata?.jobId || getJobIdFromSnapshot();
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin";
  // Accepting is required of everyone, superadmins included. The old
  // `user?.role === "superadmin" ||` bypass let an unaccepted ticket show an
  // "Accept" button and a working "Resolve Ticket" button at the same time.
  // Mirrors rejectUnacceptedChatSupport on the server.
  // A dispute is one case filed as two threads. Accepting either one accepts
  // the case, so the reported party's thread must not ask for a second Accept
  // — and must not be locked out of messaging — once the case is accepted.
  const isTicketAccepted = Boolean(
    selectedChat.acceptedBy ||
      (isDisputeTicket && counterpartChat?.acceptedBy)
  );
  const canManageTicket = isAdminUser && isTicketAccepted;
  const normalizedPriority = (selectedChat.priority || "medium").toLowerCase();

  const handleAcceptCurrentTicket = async () => {
    if (!isAdminUser || selectedChat.acceptedBy || acceptingTicket) return;

    const ticketId = selectedChat._id;
    const requestId = ++acceptRequestIdRef.current;
    setAcceptingTicket(true);
    try {
      await handleAcceptTicket(ticketId);
    } catch (error) {
      console.error("Error accepting support ticket:", error);
      if (activeTicketIdRef.current === ticketId) {
        alert("Failed to accept ticket. Please try again.");
      }
    } finally {
      if (
        requestId === acceptRequestIdRef.current &&
        activeTicketIdRef.current === ticketId
      ) {
        setAcceptingTicket(false);
      }
    }
  };

  const handleResolveDispute = async (
    outcome: "pay_provider" | "refund_client" | "rebook" | "no_show_payout",
  ) => {
    if (
      !canManageTicket ||
      !onResolveDispute ||
      !disputeJobId ||
      resolvingOutcome
    ) {
      return;
    }

    // Guard here as well as server-side so the admin gets an immediate answer
    // rather than a round trip that 400s.
    if (outcome === "rebook" && !rebookDeadline) {
      alert(
        "Set a redo deadline before resolving with rebook — the client's payment stays held until the work is redone.",
      );
      return;
    }

    const ticketId = selectedChat._id;
    const requestId = ++disputeRequestIdRef.current;
    setResolvingOutcome(outcome);
    try {
      await onResolveDispute(
        disputeJobId,
        outcome,
        disputeNote.trim() || undefined,
        // endOfLocalDay, not `new Date(value)`. The input yields "YYYY-MM-DD",
        // which Date parses as UTC midnight — 8am local in PH. That is a
        // deadline hours EARLIER than the day the admin picked, and for a
        // same-day redo it lands in the past, which the server rejects
        // outright. The whole picked day is what "by this date" means.
        outcome === "rebook"
          ? endOfLocalDay(rebookDeadline).toISOString()
          : undefined,
        { faultParty, findingReason, notes: disputeNote.trim() || undefined },
      );
      if (activeTicketIdRef.current === ticketId) {
        setDisputeNote("");
        setRebookDeadline("");
        setFaultParty("uncertain");
        setFindingReason("other");
      }
    } catch (error) {
      console.error("Error resolving dispute:", error);
      if (activeTicketIdRef.current === ticketId) {
        // Surface the server's own reason: every resolve-dispute rejection is a
        // distinct, actionable state (no active dispute left, payment already
        // released, cancelled job, bad deadline) and a generic "please try
        // again" sends the admin to retry something that can never succeed.
        const reason = (error as { response?: { data?: { error?: string } } })
          ?.response?.data?.error;
        alert(
          reason
            ? `Could not resolve the dispute.\n\n${reason}`
            : "Failed to resolve dispute. Please try again.",
        );
      }
    } finally {
      if (
        requestId === disputeRequestIdRef.current &&
        activeTicketIdRef.current === ticketId
      ) {
        setResolvingOutcome(null);
      }
    }
  };

  /**
   * The note the admin has composed right now — a canned line, or whatever they
   * typed under "Write a custom note". Empty means nothing usable yet, which is
   * what gates Resolve.
   */
  const composedResolutionNote =
    resolutionNotePreset === CUSTOM_NOTE_OPTION
      ? resolutionNoteText.trim()
      : resolutionNotePreset;

  const clearComposedNote = () => {
    setResolutionNotePreset("");
    setResolutionNoteText("");
  };

  /**
   * Everything blocking Resolve, most specific first. null = ready to go.
   * A dispute whose job still holds the client's payment has to be ruled on:
   * closing its ticket alone leaves the money frozen and takes the case out of
   * the open queue. The ruling buttons close both parties' threads themselves.
   */
  const disputeAwaitingRuling =
    isDisputeTicket && concernJob?.completionStatus?.dispute?.isActive === true;
  const resolveBlocker: string | null = disputeAwaitingRuling
    ? "This dispute still holds the client's payment — rule on it above instead."
    : composedResolutionNote
      ? null
      : "Add a resolution note above to resolve this ticket.";

  const canResolveTicket = resolveBlocker === null;

  /**
   * Applies the dispute ruling (if any) and then closes the ticket.
   *
   * Order matters and is deliberate: the ruling moves money, so it goes first
   * and the ticket is only closed once it has succeeded. Closing first would
   * risk a closed ticket whose payout or refund never happened — the harder
   * state to notice and to recover from. A failed close after a successful
   * ruling just leaves the ticket open, which the admin can simply retry.
   */
  const handleResolveTicket = async () => {
    if (!canManageTicket || !canResolveTicket || resolvingTicket) return;

    const ticketId = selectedChat._id;
    const note = composedResolutionNote;

    setResolvingTicket(true);
    try {
      await handleChatAction(ticketId, "close", note);
      if (activeTicketIdRef.current === ticketId) {
        clearComposedNote();
      }
    } catch (error) {
      console.error("Error resolving ticket:", error);
      if (activeTicketIdRef.current === ticketId) {
        alert("Failed to resolve ticket. Please try again.");
      }
    } finally {
      if (activeTicketIdRef.current === ticketId) {
        setResolvingTicket(false);
      }
    }
  };

  const handleReopenTicket = async () => {
    try {
      await handleChatAction(selectedChat._id, "reopen");
    } catch (error) {
      // Only the assigned admin or a superadmin may reopen; say so rather than
      // leave the click doing nothing.
      const data = (error as { response?: { data?: { message?: string; error?: string } } })
        ?.response?.data;
      alert(
        data?.message || data?.error || "Failed to reopen ticket. Please try again.",
      );
    }
  };

  /**
   * Restrict the account of whoever owns THIS thread.
   *
   * Scoped to the current thread's user on purpose. A dispute has two sides and
   * a single "restrict" button that had to guess which one it meant would be
   * one misclick away from restricting the wronged party — the admin switches
   * to the other party's thread (the button above) to act on them instead.
   */
  const handleRestrictThreadOwner = async () => {
    if (!canManageTicket || !selectedChat || restrictingUser) return;
    const targetId =
      typeof selectedChat.userId === "string"
        ? selectedChat.userId
        : (selectedChat.userId as any)?._id;
    if (!targetId) {
      alert("This ticket has no user attached, so there is nobody to restrict.");
      return;
    }
    const targetName =
      typeof selectedChat.userId === "string"
        ? "this user"
        : (selectedChat.userId as any)?.name || "this user";
    if (
      !window.confirm(
        `Restrict ${targetName}? They will not be able to post jobs, quote, or accept work until the restriction is lifted. They can appeal it.`,
      )
    ) {
      return;
    }
    setRestrictingUser(true);
    try {
      await usersService.restrictUser(
        targetId,
        undefined,
        disputeNote.trim() || "Restricted by support while resolving a dispute",
      );
      alert(`${targetName} has been restricted.`);
    } catch (error) {
      console.error("Error restricting user:", error);
      alert("Failed to restrict the account. Please try again.");
    } finally {
      setRestrictingUser(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (
      !canManageTicket ||
      !onAddInternalNote ||
      !internalNoteText.trim() ||
      sendingInternalNote
    ) {
      return;
    }

    const ticketId = selectedChat._id;
    const requestId = ++noteRequestIdRef.current;
    setSendingInternalNote(true);
    try {
      await onAddInternalNote(ticketId, internalNoteText.trim());
      if (activeTicketIdRef.current === ticketId) {
        setInternalNoteText("");
      }
    } catch (error) {
      console.error("Error adding internal note:", error);
      if (activeTicketIdRef.current === ticketId) {
        alert("Failed to add internal note. Please try again.");
      }
    } finally {
      if (
        requestId === noteRequestIdRef.current &&
        activeTicketIdRef.current === ticketId
      ) {
        setSendingInternalNote(false);
      }
    }
  };

  /** `explicitJobId` lets a message bubble open the job it names directly. */
  const handleViewJobDetails = async (explicitJobId?: string) => {
    const jobId = explicitJobId || getJobIdFromSnapshot();
    if (!jobId) {
      alert("Job ID not available for this ticket.");
      return;
    }

    const ticketId = selectedChat._id;
    const requestId = ++jobRequestIdRef.current;
    try {
      setJobModalLoading(true);
      const data = await jobsService.getJobById(jobId);
      if (activeTicketIdRef.current !== ticketId) return;

      setJobModalData(data);
      setJobModalOpen(true);
    } catch (error) {
      console.error("Failed to load job details:", error);
      if (activeTicketIdRef.current === ticketId) {
        alert("Failed to load job details.");
      }
    } finally {
      if (
        requestId === jobRequestIdRef.current &&
        activeTicketIdRef.current === ticketId
      ) {
        setJobModalLoading(false);
      }
    }
  };

  /**
   * On a dispute, the panel shows both parties and which way the complaint
   * runs. Roles come from userType on each thread; disputeRaisedBy names the
   * side that complained. Null when the counterpart thread isn't loaded — the
   * panel then falls back to the single-user layout rather than guessing.
   */
  const disputeParties = (() => {
    if (!isDisputeTicket || !counterpartChat) return null;
    const pair = [selectedChat, counterpartChat];
    const provider = pair.find((t) => t.userType === "provider") || null;
    const client = pair.find((t) => t.userType !== "provider") || null;
    if (!provider || !client) return null;
    const raisedByProvider =
      selectedChat.metadata?.disputeRaisedBy === "provider";
    return {
      reporter: raisedByProvider ? provider : client,
      reported: raisedByProvider ? client : provider,
      reporterRole: raisedByProvider ? "Provider" : "Client",
      reportedRole: raisedByProvider ? "Client" : "Provider",
      // The thread the admin is NOT reading — what the switch button targets.
      other: counterpartChat,
      otherRole:
        counterpartChat.userType === "provider" ? "Provider" : "Client",
    };
  })();

  /** The job currently on screen, or null when the panel is closed. */
  const openJobId = jobModalOpen
    ? String(jobModalData?.job?._id || jobModalData?._id || "")
    : null;

  /**
   * Same control opens and closes the job panel. A button that keeps saying
   * "View Job Details" while the panel is already open gives the admin no way
   * back except hunting for the panel's own close button.
   *
   * A control for a DIFFERENT job switches to it rather than closing — only the
   * control matching what is on screen toggles off.
   */
  const isJobDetailsOpenFor = (jobId?: string | null) =>
    Boolean(openJobId) && (!jobId || openJobId === String(jobId));

  const toggleJobDetails = (explicitJobId?: string) => {
    const jobId = explicitJobId || getJobIdFromSnapshot();
    if (isJobDetailsOpenFor(jobId)) {
      setJobModalOpen(false);
      return;
    }
    void handleViewJobDetails(jobId);
  };

  /**
   * What the user actually wrote when they filed — their first non-empty
   * message. The subject alone ("Payment / wallet", "Dispute: Test") rarely
   * says what the problem is, and reading it meant scrolling the transcript to
   * the very top.
   *
   * Run through parseMessageContent so the trailing "Job ID: <hex>" line and
   * any "Job Details:" block are stripped rather than shown as raw text.
   */
  const originalConcern = (() => {
    const fromUser = (selectedChat.messages || []).filter(
      (m) => m.senderType !== "Admin",
    );
    const first = fromUser.find((m) => (m.message || "").trim());
    const parsed = first ? parseMessageContent(first.message || "") : null;
    return {
      // On a dispute, what the admin needs here is the complaint. It is only
      // quoted on the raiser's thread — the reported party's thread carries a
      // notice instead — so metadata.disputeReason, which both threads carry,
      // comes first.
      text: (
        selectedChat.metadata?.disputeReason ||
        parsed?.dispute?.reason ||
        parsed?.body ||
        ""
      ).trim(),
      // Details the user typed as a "Job Details:" block, if any.
      jobDetails: parsed?.jobDetails || null,
      jobId: parsed?.jobId || null,
      at: first?.timestamp || selectedChat.createdAt,
      // Everything the user attached, not just on the opening message.
      attachments: fromUser.filter((m) => m.imageUrl).length,
      messageCount: fromUser.length,
      hasImage: fromUser.some((m) => m.imageUrl),
    };
  })();

  /**
   * The job this concern is about. Title can come from three places — prefer
   * the live job, fall back to what the ticket stored. Description only exists
   * on the job itself; no ticket carries it.
   */
  const concernJobTitle =
    concernJob?.title ||
    selectedChat.metadata?.jobTitle ||
    selectedChat.jobDetailsSnapshot?.title ||
    selectedChat.jobDetailsSnapshot?.["Job"] ||
    null;
  const concernJobDescription = (concernJob?.description || "").trim() || null;

  const firstName = selectedChat.userName?.split(" ")[0] || "";
  const lastName =
    selectedChat.userName?.split(" ").slice(1).join(" ") || firstName;

  return ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[90] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 md:left-72 h-[100dvh] bg-white shadow-2xl z-[100] flex flex-col md:flex-row overflow-hidden">
        {/* Column 1: Chat Area */}
        <div
          className={`flex-1 flex flex-col min-h-0 ${showMobileDetails ? "hidden md:flex" : "flex"}`}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 md:px-6 md:py-3 border-b bg-white relative">
            <div className="flex items-center justify-between">
              {/* Mobile Header Content */}
              <div className="md:hidden flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={onClose}
                  className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors mr-2"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      TKT ID:
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedChat.ticketId ||
                        selectedChat._id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(
                      selectedChat.status,
                      selectedChat.acceptedBy,
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Header Content - Hidden on Mobile.
                  Subject and badges share one line: as three stacked rows this
                  header ate ~135px of a fixed-height modal, all of it above the
                  conversation the admin is actually here to read. */}
              <div className="hidden md:block flex-1 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Ticket ID: {selectedChat.ticketId || selectedChat._id}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold leading-tight text-gray-900 truncate max-w-[60%]">
                    {selectedChat.subject}
                  </h3>
                  {getStatusBadge(selectedChat.status, selectedChat.acceptedBy)}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
                    {selectedChat.category}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                {/* The dispute thread switcher lives with the two parties in
                    the User Information panel — it belongs next to the people
                    it switches between, not stranded in the header. */}
                {/* Not gated on acceptedBy: an unassigned or already-resolved
                    ticket is exactly when an admin needs to look the job up. */}
                {hasJobId && (() => {
                  const showing = isJobDetailsOpenFor(getJobIdFromSnapshot());
                  return (
                    <button
                      data-testid="header-job-details-toggle"
                      onClick={() => toggleJobDetails()}
                      disabled={jobModalLoading}
                      aria-expanded={showing}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-full shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                        showing
                          ? "bg-gray-900 text-white hover:bg-gray-800"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {showing ? <X className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {jobModalLoading
                        ? "Loading…"
                        : showing
                          ? "Close Job Details"
                          : "View Job Details"}
                    </button>
                  );
                })()}
                {selectedChat.status === "open" &&
                  !isTicketAccepted &&
                  (user?.role === "admin" || user?.role === "superadmin") && (
                    <button
                      data-testid="support-chat-accept-btn"
                      onClick={handleAcceptCurrentTicket}
                      disabled={acceptingTicket}
                      className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      {acceptingTicket ? (
                        <RefreshCw className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                      )}
                      {acceptingTicket ? "Accepting?" : "Accept"}
                    </button>
                  )}

                {/* Desktop Actions - Removed */}

                {/* Mobile Menu / Details Toggle */}
                <button
                  data-testid="support-chat-mobile-details-btn"
                  onClick={() => setShowMobileDetails(true)}
                  className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {/* Desktop Close Button - Removed */}
              </div>
            </div>
          </div>

          {jobModalOpen && (
            <JobDetailsModal
              isOpen={jobModalOpen}
              onClose={() => setJobModalOpen(false)}
              job={jobModalData?.job || jobModalData}
            />
          )}

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-50 p-4 md:p-6">
            {!selectedChat.messages || selectedChat.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-base font-medium text-gray-600">
                    No messages yet
                  </p>
                  <p className="text-sm text-gray-500">
                    Start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              selectedChat.messages.map((msg, index) => {
                const isAdmin = msg.senderType === "Admin";
                // Known here so the bubble can strip its own chrome for a
                // dispute filing, which renders its own container.
                const isDisputeOpener = Boolean(
                  msg.message && parseMessageContent(msg.message).dispute,
                );
                const currentDate = new Date(msg.timestamp);
                const previousDate =
                  index > 0
                    ? new Date(selectedChat.messages![index - 1].timestamp)
                    : null;

                // Check if this is a system message
                const isTicketSummary =
                  !!msg.message && (
                    msg.message.includes("PREVIOUS TICKET RESOLVED") ||
                    msg.message.includes("Previous Ticket Summary")
                  );
                const messageText = (msg.message || '').toLowerCase();
                const isSystemMessage =
                  !isTicketSummary &&
                  isAdmin &&
                  (messageText.includes("ticket has been") ||
                    messageText.includes("chat has been") ||
                    messageText.includes("ticket reopened") ||
                    messageText.includes("chat reopened"));

                const showDateSeparator =
                  !previousDate ||
                  currentDate.toDateString() !== previousDate.toDateString();

                // Internal admin-only notes (dispute mediation reasoning, SLA
                // escalation flags) — never shown to the customer, so only an
                // admin viewing this same thread ever sees this branch render.
                if (msg.isInternal) {
                  return (
                    <div
                      key={msg._id || index}
                      ref={(el) => {
                        messageRefs.current[msg._id || `msg-${index}`] = el;
                      }}
                      className="my-3 mx-auto min-w-0 max-w-lg rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">
                        Internal Note — {msg.senderName || "Admin"} (not visible to user)
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm text-amber-900 [overflow-wrap:anywhere]">
                        {msg.message}
                      </p>
                      <p className="text-[10px] text-amber-600 mt-1">
                        {new Date(msg.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  );
                }

                const getDateLabel = (date: Date) => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);

                  if (date.toDateString() === today.toDateString()) {
                    return "Today";
                  } else if (date.toDateString() === yesterday.toDateString()) {
                    return "Yesterday";
                  } else {
                    return date.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    });
                  }
                };

                const previousMsg =
                  index > 0 ? selectedChat.messages![index - 1] : null;
                const nextMsg =
                  index < selectedChat.messages!.length - 1
                    ? selectedChat.messages![index + 1]
                    : null;

                const isGroupedWithPrevious =
                  previousMsg &&
                  previousMsg.senderType === msg.senderType &&
                  currentDate.getTime() -
                    new Date(previousMsg.timestamp).getTime() <
                    5 * 60 * 1000 &&
                  currentDate.toDateString() ===
                    new Date(previousMsg.timestamp).toDateString();

                const isGroupedWithNext =
                  nextMsg &&
                  nextMsg.senderType === msg.senderType &&
                  new Date(nextMsg.timestamp).getTime() -
                    currentDate.getTime() <
                    5 * 60 * 1000 &&
                  currentDate.toDateString() ===
                    new Date(nextMsg.timestamp).toDateString();

                const showSenderName = !isGroupedWithPrevious;
                const showTimestamp = !isGroupedWithNext;

                // Determine if this is a special message (resolved, reopened, accepted)
                const isResolvedMessage =
                  messageText.includes("resolved") ||
                  messageText.includes("closed");
                const isReopenedMessage = messageText.includes("reopened");
                // Generate a stable ID for special messages.
                let messageId = msg._id || `msg-${index}`;
                if (isResolvedMessage) messageId = `resolved-${msg.timestamp}`;
                if (isReopenedMessage) messageId = `reopened-${msg.timestamp}`;

                // Render ticket summary message differently
                if (isTicketSummary) {
                  const parseSummary = (text: string) => {
                    const sections = text
                      .split(/(?=✓|⚡)/)
                      .filter((s) => s.trim());
                    return sections.map((section) => {
                      const lines = section.split("\n").filter((l) => l.trim());
                      const title = lines[0];
                      const details: { [key: string]: string } = {};

                      lines.slice(1).forEach((line) => {
                        const colonIndex = line.indexOf(":");
                        if (colonIndex > -1) {
                          const key = line.substring(0, colonIndex).trim();
                          const value = line.substring(colonIndex + 1).trim();
                          details[key] = value;
                        }
                      });

                      return { title, details };
                    });
                  };

                  const sections = parseSummary(msg.message);

                  return (
                    <React.Fragment key={msg._id || index}>
                      <div className="flex justify-center my-8 px-4">
                        <div className="w-full max-w-xs">

                          {sections.map((section, sectionIndex) => {
                            const isResolved = section.title.includes("✓");
                            const isNewTicket = section.title.includes("⚡");
                            const titleText = section.title.replace(
                              /^[✓⚡📋]\s*/u,
                              "",
                            );

                            return (
                              <React.Fragment key={sectionIndex}>
                                {/* Dashed connector between cards */}
                                {sectionIndex > 0 && (
                                  <div className="flex justify-center py-0.5">
                                    <div className="w-px h-5 border-l-2 border-dashed border-gray-300" />
                                  </div>
                                )}

                                <div
                                  className={`rounded-2xl overflow-hidden ${
                                    isResolved
                                      ? "ring-1 ring-emerald-200"
                                      : isNewTicket
                                        ? "ring-1 ring-orange-200"
                                        : "ring-1 ring-gray-200"
                                  }`}
                                >
                                  {/* Coloured header bar */}
                                  <div
                                    className={`flex items-center justify-between px-4 py-2.5 ${
                                      isResolved
                                        ? "bg-emerald-500"
                                        : isNewTicket
                                          ? "bg-orange-400"
                                          : "bg-gray-500"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isResolved && (
                                        <CheckCircle
                                          className="w-3.5 h-3.5 text-white"
                                          strokeWidth={2.5}
                                        />
                                      )}
                                      {isNewTicket && (
                                        <MessageSquare
                                          className="w-3.5 h-3.5 text-white"
                                          strokeWidth={2.5}
                                        />
                                      )}
                                      <span className="text-white text-[11px] font-bold uppercase tracking-widest">
                                        {titleText}
                                      </span>
                                    </div>
                                    {isResolved && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider bg-white/25 text-white rounded-full px-2 py-0.5">
                                        Closed
                                      </span>
                                    )}
                                    {isNewTicket && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider bg-white/25 text-white rounded-full px-2 py-0.5">
                                        Open
                                      </span>
                                    )}
                                  </div>

                                  {/* Detail rows */}
                                  {Object.keys(section.details).length > 0 && (
                                    <div
                                      className={`divide-y bg-white ${
                                        isResolved
                                          ? "divide-emerald-50"
                                          : isNewTicket
                                            ? "divide-orange-50"
                                            : "divide-gray-50"
                                      }`}
                                    >
                                      {Object.entries(section.details).map(
                                        ([key, value], detailIndex) => (
                                          <div
                                            key={detailIndex}
                                            className="flex items-start justify-between gap-4 px-4 py-2.5"
                                          >
                                            <span
                                              className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap flex-shrink-0 ${
                                                isResolved
                                                  ? "text-emerald-600"
                                                  : isNewTicket
                                                    ? "text-orange-500"
                                                    : "text-gray-500"
                                              }`}
                                            >
                                              {key}
                                            </span>
                                            <span className="text-[12px] text-gray-800 font-medium text-right leading-snug">
                                              {value}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              </React.Fragment>
                            );
                          })}

                          {/* Timestamp pill */}
                          <div className="flex justify-center mt-4">
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(msg.timestamp).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}{" · "}
                              {new Date(msg.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )}
                            </span>
                          </div>

                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                // Render system message differently
                if (isSystemMessage) {
                  // Check if this is a resolved/closed message
                  const isResolvedOrClosed =
                    messageText.includes("resolved") ||
                    messageText.includes("closed");

                  if (isResolvedOrClosed) {
                    // Display as a centered message like image 2
                    return (
                      <React.Fragment key={msg._id || index}>
                        <div className="flex items-center justify-center my-3">
                          <div className="flex flex-col items-center">
                            <div
                              ref={(el) => {
                                messageRefs.current[messageId] = el;
                              }}
                              className="text-sm text-gray-600 font-medium"
                            >
                              {formatSystemEventMessage(msg)}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )}
                            </p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }

                  // For other system messages (reopened, etc)
                  return (
                    <React.Fragment key={msg._id || index}>
                      <div className="flex items-center justify-center my-3">
                        <div className="flex flex-col items-center">
                          <div
                            ref={(el) => {
                              messageRefs.current[messageId] = el;
                            }}
                            className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full"
                          >
                            {formatSystemEventMessage(msg)}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {(() => {
                              const messageDate = new Date(msg.timestamp);
                              const today = new Date();
                              const isToday =
                                messageDate.toDateString() ===
                                today.toDateString();

                              if (isToday) {
                                return messageDate.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                });
                              } else {
                                return messageDate.toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                });
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={msg._id || index}>
                    <div
                      className={`flex min-w-0 ${isAdmin ? "justify-end" : "justify-start"} ${isGroupedWithNext ? "mb-1" : "mb-3"}`}
                    >
                      {!isAdmin &&
                        (selectedChat.userProfileImage ? (
                          <img
                            src={selectedChat.userProfileImage}
                            alt={selectedChat.userName || "User"}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 mr-2 mt-1"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                            <span className="text-xs font-semibold text-gray-700">
                              {getInitials(selectedChat.userName || "User")}
                            </span>
                          </div>
                        ))}
                      <div
                        className={`min-w-0 max-w-[75%] ${
                          isAdmin ? "text-right" : "text-left"
                        }`}
                      >
                        <div
                          ref={(el) => {
                            messageRefs.current[messageId] = el;
                          }}
                          /* A dispute filing supplies its own container, so the
                             chat bubble drops its white background, shadow and
                             padding — otherwise the notice sits boxed inside a
                             second box. */
                          className={`inline-block min-w-0 max-w-full rounded-2xl overflow-hidden text-left ${
                            isDisputeOpener
                              ? "bg-transparent"
                              : isAdmin
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-900 shadow-sm"
                          } ${
                            isDisputeOpener || (msg.imageUrl && !msg.message)
                              ? ""
                              : "px-4 py-2.5"
                          }`}
                        >
                          {msg.imageUrl && (
                            <a
                              href={msg.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Click to open full image"
                            >
                              <img
                                src={msg.imageUrl}
                                alt="Attachment"
                                className="block max-w-[240px] max-h-[240px] w-auto h-auto object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ display: 'block' }}
                              />
                            </a>
                          )}
                          {(() => {
                            if (!msg.message) return null;
                            const parsed = parseMessageContent(msg.message);
                            const isUser = !isAdmin;
                            return (
                              <div className={msg.imageUrl ? "px-4 pb-2.5 pt-1" : "px-4 py-2.5"}>
                                {/* A dispute filing gets its own treatment: the
                                    boilerplate becomes a small caption and the
                                    reason — the part an admin has to read —
                                    becomes the prominent line. Red, and sized
                                    up: this is the most consequential message
                                    in the thread. */}
                                {parsed.dispute ? (
                                  <div
                                    data-testid="dispute-opener"
                                    className={`rounded-xl border border-l-4 px-4 py-3.5 ${
                                      isUser
                                        ? "border-red-200 border-l-red-500 bg-red-50"
                                        : "border-white/30 border-l-white/80 bg-white/10"
                                    }`}
                                  >
                                    <p
                                      className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${
                                        isUser ? "text-red-600" : "text-white/85"
                                      }`}
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                      {parsed.dispute.raisedBy}
                                    </p>
                                    {parsed.dispute.reason ? (
                                      <p
                                        className={`mt-1.5 whitespace-pre-wrap break-words text-[17px] font-semibold leading-snug [overflow-wrap:anywhere] ${
                                          isUser ? "text-red-950" : "text-white"
                                        }`}
                                      >
                                        {parsed.dispute.reason}
                                      </p>
                                    ) : (
                                      <p
                                        className={`mt-1.5 text-sm italic ${
                                          isUser ? "text-red-400" : "text-white/70"
                                        }`}
                                      >
                                        No reason given.
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  parsed.body && (
                                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                                      {parsed.body}
                                    </p>
                                  )
                                )}
                                {parsed.jobDetails && (
                                  <JobDetailsCard entries={parsed.jobDetails} isUser={isUser} />
                                )}
                                {!parsed.body && !parsed.jobDetails && !parsed.jobId && !parsed.dispute && (
                                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                                    {msg.message}
                                  </p>
                                )}
                                {/* Replaces the raw "Job ID: <hex>" line the
                                    message carried — an id an admin cannot use
                                    becomes the action they actually wanted. */}
                                {parsed.jobId && (() => {
                                  const showing = isJobDetailsOpenFor(parsed.jobId);
                                  return (
                                    <button
                                      type="button"
                                      data-testid="message-view-job-details"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleJobDetails(parsed.jobId as string);
                                      }}
                                      disabled={jobModalLoading}
                                      aria-expanded={showing}
                                      title={`Job ${parsed.jobId}`}
                                      className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                        isUser
                                          ? "bg-white/70 text-blue-700 hover:bg-white border border-blue-100"
                                          : "bg-white/15 text-white hover:bg-white/25 border border-white/25"
                                      }`}
                                    >
                                      {showing ? (
                                        <X className="h-3.5 w-3.5" />
                                      ) : (
                                        <Briefcase className="h-3.5 w-3.5" />
                                      )}
                                      {jobModalLoading
                                        ? "Loading…"
                                        : showing
                                          ? "Close Job Details"
                                          : "View Job Details"}
                                    </button>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                        </div>
                        {showTimestamp && (
                          <p
                            className={`text-xs mt-1 px-1 ${
                              isAdmin
                                ? "text-gray-500 text-right"
                                : "text-gray-500 text-left"
                            }`}
                          >
                            {new Date(msg.timestamp)
                              .toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                              .toUpperCase()}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 ml-2 mt-1">
                          <span className="text-xs font-semibold text-white">
                            {getInitials(msg.senderName || "Admin")}
                          </span>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messageEndRef} />
          </div>

          {/* Message Input */}
          {selectedChat.status === "open" ? (
            !canManageTicket ? (
              <div className="flex-shrink-0 p-6 bg-gray-100 border-t">
                <div className="flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-600">
                    Accept this ticket before sending messages or taking action
                  </p>
                </div>
              </div>
            ) : user?.role !== "admin" && user?.role !== "superadmin" ? (
              <div className="flex-shrink-0 p-6 bg-gray-100 border-t">
                <div className="flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-600">
                    Only admins can send messages to tickets
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 p-6 bg-gray-100 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter a message..."
                    className="flex-1 px-4 py-2 md:py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !sendingMessage) {
                        sendMessage();
                      }
                    }}
                    disabled={sendingMessage}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim() || sendingMessage}
                    className="px-4 md:px-8 py-2 md:py-3 bg-gray-900 text-white rounded-full md:rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all flex items-center justify-center"
                  >
                    <span className="hidden md:inline">Send</span>
                    <Send className="md:hidden h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex-shrink-0 p-6 bg-gray-100 border-t">
              <div className="flex items-center justify-center">
                <p className="text-sm font-medium text-gray-600">
                  Ticket has been resolved
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Column 2: User Information & Details Sidebar.

            The show/hide toggle must stay within the `flex` family. It used to
            emit `block` / `hidden md:block`; Tailwind emits breakpoint variants
            after the base utilities, so on desktop that `md:block` beat the base
            `flex` and the panel rendered as display:block. `flex-1` on the
            scroll area below was then inert, its height collapsed to the
            content, and `overflow-hidden` here clipped everything past the fold
            with no scrollbar — Resolve Dispute and Internal Note sit at the
            bottom of that area and were unreachable. */}
        <div
          // 550px matches JobDetailsModal's panel, which opens over this one —
          // a narrower panel made the two look like different surfaces. shrink-0
          // pins it: as a flex item it would otherwise be squeezed by the chat
          // column and no longer match.
          className={`flex-col h-full bg-gray-50 fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto md:w-[550px] md:shrink-0 border-l border-gray-300 min-h-0 overflow-hidden ${showMobileDetails ? "flex" : "hidden md:flex"}`}
        >
          {/* Header with Close Button */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileDetails(false)}
                className="md:hidden p-1 -ml-1 text-gray-600 hover:bg-gray-200 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-bold text-gray-900">
                User Information
              </h3>
            </div>

            <button
              onClick={onClose}
              className="hidden md:block p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0 pb-24">
            {/* The dispute's two parties, and which way the complaint runs.
                Stated as a sentence rather than labelled with a heading, and
                left unboxed so it reads as part of the panel instead of an
                interruption. Doubles as the thread switcher. */}
            {isDisputeTicket && (
              <div className="px-6 pt-6">
                {disputeParties ? (
                  <>
                    <p className="text-sm leading-snug text-gray-600">
                      <span className="font-bold text-gray-900">
                        {disputeParties.reporter.userName || "One party"}
                      </span>{" "}
                      reported{" "}
                      <span className="font-bold text-gray-900">
                        {disputeParties.reported.userName || "the other"}
                      </span>
                    </p>
                    {/* Caption and the thread switcher share a row: the button
                        acts on exactly what the sentence describes. */}
                    <div className="mt-1 mb-3 flex items-start justify-between gap-3">
                      <p className="text-[11px] leading-relaxed text-gray-400">
                        Each party has their own thread — talk to both before
                        ruling.
                      </p>
                      {onSwitchChat && (
                        <button
                          type="button"
                          data-testid="dispute-counterpart-switch-btn"
                          onClick={() => onSwitchChat(disputeParties.other)}
                          title={`Open ${disputeParties.other.userName || "the other party"}'s thread of this dispute`}
                          className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Switch to {disputeParties.otherRole}
                          {(disputeParties.other.unreadCount || 0) > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {disputeParties.other.unreadCount}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {([
                        {
                          party: disputeParties.reporter,
                          role: disputeParties.reporterRole,
                          tag: "Reporter",
                          accent: "text-amber-600",
                          rail: "bg-amber-400",
                        },
                        {
                          party: disputeParties.reported,
                          role: disputeParties.reportedRole,
                          tag: "Reported",
                          accent: "text-red-500",
                          rail: "bg-red-400",
                        },
                      ] as {
                        party: typeof selectedChat;
                        role: string;
                        tag: string;
                        accent: string;
                        rail: string;
                      }[]).map(({ party, role, tag, accent, rail }) => {
                        const viewing = party._id === selectedChat._id;
                        return (
                          <div
                            key={party._id}
                            data-testid={`dispute-party-${tag.toLowerCase()}`}
                            className={`relative flex items-center gap-3 overflow-hidden rounded-lg border py-2.5 pl-4 pr-3 transition-colors ${
                              viewing
                                ? "border-gray-300 bg-gray-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            {/* Colour rail carries the reporter/reported
                                distinction without another badge. */}
                            <span
                              aria-hidden="true"
                              className={`absolute inset-y-0 left-0 w-1 ${rail}`}
                            />
                            {party.userProfileImage ? (
                              <img
                                src={party.userProfileImage}
                                alt={party.userName || "User"}
                                className="h-9 w-9 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200">
                                <span className="text-xs font-bold text-gray-600">
                                  {getInitials(party.userName || "Unknown")}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-gray-900">
                                {party.userName || "Unknown"}
                                {(party.unreadCount || 0) > 0 && (
                                  <span
                                    title={`${party.unreadCount} unread in this thread`}
                                    className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 align-middle text-[10px] font-bold text-white"
                                  >
                                    {party.unreadCount}
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-[11px]">
                                <span className={`font-bold ${accent}`}>{tag}</span>
                                <span className="text-gray-400"> · {role}</span>
                              </p>
                            </div>
                            {/* Switching lives on the caption row above; rows
                                only mark which thread is on screen. */}
                            {viewing && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                Viewing
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs leading-relaxed text-gray-400">
                    The other party&apos;s thread isn&apos;t loaded, so the
                    direction of this dispute can&apos;t be shown — check the
                    Support inbox for the matching “{selectedChat.subject}” ticket.
                  </p>
                )}
              </div>
            )}
            <div className="px-6 py-6">
              {isDisputeTicket && (
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Thread you are viewing
                </p>
              )}
              <div className="flex items-start gap-4 mb-6">
                {selectedChat.userProfileImage ? (
                  <img
                    src={selectedChat.userProfileImage}
                    alt={selectedChat.userName || "User"}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-gray-600">
                      {getInitials(
                        selectedChat.userName ||
                          selectedChat.userEmail ||
                          "Unknown",
                      )}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">
                    {selectedChat.userName || "Username"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedChat.userEmail || "Email"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">First Name: </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {firstName}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Last Name: </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {lastName}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">User Type: </span>
                  <UserTypeBadge userType={selectedChat.userType || "client"} />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 my-4"></div>

            {/* The concern itself — what the user reported, in the panel's
                own label/value idiom rather than a card. */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Concern</h3>

              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Subject: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.subject || "No subject"}
                  </span>
                  {/* The report itself sits directly under its subject — they
                      are one thought, and splitting them put the description
                      below unrelated metadata. */}
                  {originalConcern.text ? (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-gray-700 [overflow-wrap:anywhere]">
                      {originalConcern.text}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs italic text-gray-400">
                      {originalConcern.hasImage
                        ? "Opened with an attachment and no message."
                        : "No description was provided."}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-sm text-gray-600">Category: </span>
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-purple-800 align-middle">
                    {selectedChat.category || "general"}
                  </span>
                  {isDisputeTicket && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 align-middle">
                      Dispute
                    </span>
                  )}
                </div>

                {concernJobTitle && (
                  <div>
                    <span className="text-sm text-gray-600">Job title: </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {concernJobTitle}
                    </span>
                  </div>
                )}

                {concernJobDescription && (
                  <div>
                    <span className="text-sm text-gray-600">Job description: </span>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-gray-700 [overflow-wrap:anywhere]">
                      {concernJobDescription}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-gray-600">Reported by: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.userName || "the user"}
                  </span>
                </div>

                {originalConcern.at && (
                  <div>
                    <span className="text-sm text-gray-600">Reported on: </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(originalConcern.at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}

                {originalConcern.attachments > 0 && (
                  <div>
                    <span className="text-sm text-gray-600">Attachments: </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {originalConcern.attachments}
                    </span>
                  </div>
                )}
              </div>

              {originalConcern.jobId && (
                <button
                  type="button"
                  onClick={() => toggleJobDetails(originalConcern.jobId as string)}
                  disabled={jobModalLoading}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  {isJobDetailsOpenFor(originalConcern.jobId)
                    ? "Close Job Details"
                    : "View Job Details"}
                </button>
              )}
            </div>

            <div className="border-t border-gray-300 my-4"></div>

            {/* Ticket Details */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Ticket Details
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Ticket ID: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.ticketId || selectedChat._id}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Created At: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {new Date(selectedChat.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Priority:</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${getPriorityClasses(
                      normalizedPriority,
                    )}`}
                  >
                    {normalizedPriority}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Last Update: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.updatedAt
                      ? new Date(selectedChat.updatedAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Response Time: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.acceptedAt
                      ? formatResponseTime(
                          Math.round(
                            (new Date(selectedChat.acceptedAt).getTime() -
                              new Date(selectedChat.createdAt).getTime()) /
                              (1000 * 60),
                          ),
                        )
                      : "Pending"}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Assigned To: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.assignedToName ||
                      selectedChat.acceptedByName ||
                      "Unassigned"}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 my-4"></div>

            {/* Activity History */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Activity History
              </h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {(() => {
                  const events: {
                    type: string;
                    title: string;
                    date: string;
                    timestamp: number;
                    messageId: string | null;
                    reason?: string;
                  }[] = [];

                  // 1. Ticket Submitted
                  const firstUserMessage = selectedChat.messages?.[0];
                  events.push({
                    type: "submitted",
                    title: "Ticket Submitted",
                    date: selectedChat.createdAt,
                    timestamp: new Date(selectedChat.createdAt).getTime(),
                    messageId: firstUserMessage
                      ? firstUserMessage._id || "msg-0"
                      : null,
                  });

                  // 2. Ticket Accepted ? use persisted acceptance metadata,
                  // not the first admin or system message in the thread.
                  if (selectedChat.acceptedAt) {
                    const acceptanceMessage = selectedChat.messages?.find(
                      (msg) =>
                        msg.senderType === "Admin" &&
                        msg.message.toLowerCase().includes("accepted"),
                    );
                    events.push({
                      type: "accepted",
                      title: selectedChat.acceptedByName
                        ? `Ticket Accepted by ${selectedChat.acceptedByName}`
                        : "Ticket Accepted",
                      date: selectedChat.acceptedAt,
                      timestamp: new Date(selectedChat.acceptedAt).getTime(),
                      messageId: acceptanceMessage?._id || null,
                    });
                  }

                  // 3. Status history (resolved / reopened)
                  if (
                    selectedChat.statusHistory &&
                    selectedChat.statusHistory.length > 0
                  ) {
                    selectedChat.statusHistory.forEach((historyItem) => {
                      let correspondingMessage = null;

                      if (historyItem.status === "resolved") {
                        const historyTime = new Date(
                          historyItem.timestamp,
                        ).getTime();
                        correspondingMessage = selectedChat.messages?.find(
                          (msg) => {
                            const txt = msg.message.toLowerCase();
                            const msgTime = new Date(msg.timestamp).getTime();
                            return (
                              msg.senderType === "Admin" &&
                              (txt.includes("resolved") ||
                                txt.includes("closed")) &&
                              Math.abs(msgTime - historyTime) < 5000
                            );
                          },
                        );
                      } else if (historyItem.status === "reopened") {
                        const historyTime = new Date(
                          historyItem.timestamp,
                        ).getTime();
                        correspondingMessage = selectedChat.messages?.find(
                          (msg) => {
                            const txt = msg.message.toLowerCase();
                            const msgTime = new Date(msg.timestamp).getTime();
                            return (
                              msg.senderType === "Admin" &&
                              txt.includes("reopened") &&
                              Math.abs(msgTime - historyTime) < 5000
                            );
                          },
                        );
                      }

                      const messageId = correspondingMessage
                        ? `${historyItem.status}-${correspondingMessage.timestamp}`
                        : null;

                      events.push({
                        type: historyItem.status,
                        title:
                          historyItem.status === "resolved"
                            ? "Ticket Resolved"
                            : "Ticket Reopened",
                        date: historyItem.timestamp,
                        timestamp: new Date(historyItem.timestamp).getTime(),
                        reason: historyItem.reason,
                        messageId,
                      });
                    });
                  }

                  // Sort chronologically
                  events.sort((a, b) => a.timestamp - b.timestamp);

                  // Render timeline
                  return events.map((event, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${event.messageId ? "cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded transition-colors" : ""}`}
                      onClick={() =>
                        event.messageId && scrollToMessage(event.messageId)
                      }
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></div>
                        {idx < events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-300 mt-1 min-h-[32px]"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(event.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        {event.reason && (
                          <p className="text-xs text-gray-600 mt-0.5 italic">
                            Reason: {event.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
            {isAdminUser && !canManageTicket && selectedChat.status === "open" && (
              <>
                <div className="border-t border-gray-300 my-4"></div>
                <div className="px-6 pb-6">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      Accept this ticket to take ownership
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      Messaging, internal notes, dispute rulings, and resolution
                      actions are locked until the ticket is accepted.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Dispute Resolution — only on tickets raiseDispute filed
                (metadata.kind === 'dispute'); see improvements doc §6. */}
            {isDisputeTicket &&
              selectedChat.status === "open" &&
              canManageTicket && (
                <>
                  <div className="border-t border-gray-300 my-4"></div>
                  <div className="px-6 pb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Resolve Dispute
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Pick the outcome once you've reviewed both parties'
                      dispute threads for this job.
                    </p>
                    <textarea
                      data-testid="resolve-dispute-note"
                      value={disputeNote}
                      onChange={(e) => setDisputeNote(e.target.value)}
                      placeholder="Resolution note (sent to both parties)…"
                      rows={2}
                      className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />

                    {/* The FINDING — who failed, and how — recorded separately
                        from where the money goes. The same refund can mean "the
                        provider never arrived", "the work was unacceptable" or
                        "both sides called it off", so the outcome alone cannot
                        carry it. Left as "Not established" this records honestly
                        and sanctions nobody. */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
                      <p className="text-[11px] font-bold text-gray-700 mb-1">
                        Finding (who was at fault)
                      </p>
                      <p className="text-[11px] text-gray-500 mb-2">
                        Recorded against the party named and counted toward their
                        restriction threshold. Leave as &quot;Not established&quot;
                        when the case genuinely cannot be called — an unstated
                        finding sanctions nobody. An emergency is recorded but never
                        sanctioned.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          data-testid="resolve-dispute-fault-party"
                          aria-label="Party at fault"
                          value={faultParty}
                          onChange={(e) =>
                            setFaultParty(e.target.value as FaultParty)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="uncertain">Not established</option>
                          <option value="none">Nobody at fault</option>
                          <option value="client">Client at fault</option>
                          <option value="provider">Provider at fault</option>
                          <option value="both">Both at fault</option>
                        </select>
                        <select
                          data-testid="resolve-dispute-finding-reason"
                          aria-label="What happened"
                          value={findingReason}
                          onChange={(e) =>
                            setFindingReason(e.target.value as FindingReason)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="other">Other / unspecified</option>
                          <option value="no_show">Did not attend</option>
                          <option value="late_cancel">Cancelled too late</option>
                          <option value="access_failure">Could not access site</option>
                          <option value="emergency">Emergency (not sanctioned)</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <button
                        data-testid="resolve-dispute-pay-provider"
                        onClick={() => handleResolveDispute("pay_provider")}
                        disabled={!!resolvingOutcome}
                        className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {resolvingOutcome === "pay_provider"
                          ? "Resolving…"
                          : "Pay Provider"}
                      </button>
                      <button
                        data-testid="resolve-dispute-refund-client"
                        onClick={() => handleResolveDispute("refund_client")}
                        disabled={!!resolvingOutcome}
                        className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {resolvingOutcome === "refund_client"
                          ? "Resolving…"
                          : "Refund Client"}
                      </button>
                      <button
                        data-testid="resolve-dispute-no-show-payout"
                        onClick={() => handleResolveDispute("no_show_payout")}
                        disabled={!!resolvingOutcome}
                        className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {resolvingOutcome === "no_show_payout"
                          ? "Resolving…"
                          : "Client Did Not Appear"}
                      </button>
                      <p className="text-[11px] text-gray-500 px-1 -mt-1">
                        Pays the provider the reserved-time payout for the slot they
                        held and refunds the rest to the client. The payout is held
                        for the job&apos;s normal release window, not paid instantly.
                      </p>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <label
                          htmlFor="rebook-deadline"
                          className="block text-[11px] font-bold text-gray-700 mb-1"
                        >
                          Redo deadline
                        </label>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Rebook keeps the client&apos;s payment held and pauses
                          the payout countdown. A new hold starts from the new
                          completion. Required — we escalate back to you if the
                          work isn&apos;t redone by this date.
                        </p>
                        <input
                          id="rebook-deadline"
                          data-testid="resolve-dispute-rebook-deadline"
                          type="date"
                          value={rebookDeadline}
                          min={new Date(Date.now() + 86400000)
                            .toISOString()
                            .slice(0, 10)}
                          onChange={(e) => setRebookDeadline(e.target.value)}
                          className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          data-testid="resolve-dispute-rebook"
                          onClick={() => handleResolveDispute("rebook")}
                          disabled={!!resolvingOutcome || !rebookDeadline}
                          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {resolvingOutcome === "rebook"
                            ? "Resolving…"
                            : "Rebook"}
                        </button>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-[11px] font-bold text-gray-700 mb-1">
                          Account action
                        </p>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Separate from the money outcome, and scoped to THIS
                          thread&apos;s party. Repeated missed bookings restrict an
                          account on their own; use this when one case warrants it
                          now. The resolution note above is recorded as the reason.
                        </p>
                        <button
                          data-testid="dispute-restrict-user"
                          onClick={handleRestrictThreadOwner}
                          disabled={restrictingUser || !!resolvingOutcome}
                          className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {restrictingUser
                            ? "Restricting…"
                            : "Restrict This Account"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

            {/* Internal Notes — admin-only, never rendered to the customer
                (see isInternal on ChatSupport.messages). */}
            {canManageTicket && (
              <>
                <div className="border-t border-gray-300 my-4"></div>
                <div className="px-6 pb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Internal Note
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Visible only to admins — never shown to the user.
                  </p>
                  <textarea
                    data-testid="internal-note-input"
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    placeholder="Add a note for other admins…"
                    rows={2}
                    className="w-full mb-2 px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button
                    data-testid="internal-note-submit"
                    onClick={handleAddInternalNote}
                    disabled={!internalNoteText.trim() || sendingInternalNote}
                    className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendingInternalNote ? "Adding…" : "Add Internal Note"}
                  </button>
                </div>
              </>
            )}

            {/* Resolution Note — required to resolve. There is no separate
                submit: the note is sent with the close request, so a ticket can
                never be resolved without one. Only shown while the ticket is
                still open, since it exists purely to gate that action. */}
            {canManageTicket && selectedChat.status === "open" && (
              <>
                <div className="border-t border-gray-300 my-4"></div>
                <div className="px-6 pb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Resolution Note
                    <span className="ml-1 text-red-500" aria-hidden="true">
                      *
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Required to resolve. Recorded in the activity log and{" "}
                    <span className="font-semibold text-gray-700">
                      sent to the customer
                    </span>{" "}
                    as the reason this ticket was closed.
                  </p>

                  {/* Two ways in: pick a canned line, or switch to free text. */}
                  <select
                    data-testid="resolution-note-preset"
                    value={resolutionNotePreset}
                    onChange={(e) => {
                      setResolutionNotePreset(e.target.value);
                      if (e.target.value !== CUSTOM_NOTE_OPTION) {
                        setResolutionNoteText("");
                      }
                    }}
                    className="w-full mb-2 px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a note…</option>
                    {RESOLUTION_NOTE_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                    <option value={CUSTOM_NOTE_OPTION}>
                      Write a custom note…
                    </option>
                  </select>

                  {resolutionNotePreset === CUSTOM_NOTE_OPTION && (
                    <textarea
                      data-testid="resolution-note-input"
                      value={resolutionNoteText}
                      onChange={(e) => setResolutionNoteText(e.target.value)}
                      placeholder="Explain how this was resolved — the customer will see this…"
                      rows={3}
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>
              </>
            )}

            {/* Actions - Visible on both Mobile and Desktop */}
          </div>

          {/* Sticky Footer Actions */}
          {/* Resolving requires acceptance; reopening does not. A closed ticket
              can have no acceptedBy, and Accept is only offered while a ticket
              is open — gating reopen on acceptance would strand it closed. */}
          {((canManageTicket && selectedChat.status === "open") ||
            (isAdminUser && selectedChat.status === "closed")) && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50 z-[50]">
                {selectedChat.status === "open" ? (
                  <>
                    {resolveBlocker && (
                      <p
                        data-testid="resolve-note-required"
                        className="mb-2 text-center text-xs font-medium text-amber-700"
                      >
                        {resolveBlocker}
                      </p>
                    )}
                    <button
                      data-testid="resolve-ticket"
                      onClick={handleResolveTicket}
                      disabled={!canResolveTicket || resolvingTicket}
                      title={resolveBlocker || undefined}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900 disabled:active:scale-100"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {resolvingTicket ? "Resolving…" : "Resolve Ticket"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReopenTicket}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 text-sm font-medium"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reopen Ticket
                  </button>
                )}
              </div>
            )}
        </div>

        {/* Mobile Actions in User Info Sidebar - Removed */}
      </div>
    </>,
    document.body,
  );
};

export default SupportChatModal;
