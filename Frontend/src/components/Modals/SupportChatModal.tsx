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
  Tag,
  MapPin,
  Calendar,
  Info,
} from "lucide-react";
import { getStatusBadge } from "../../utils";
import UserTypeBadge from "../UI/UserTypeBadge";
import { useAuth } from "../../context/AuthContext";
import { jobsService } from "../../services";
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
  handleChatAction: (chatSupportId: string, action: string) => void;
  handleAcceptTicket: (chatSupportId: string) => Promise<void> | void;
  onResolveDispute?: (
    jobId: string,
    outcome: "pay_provider" | "refund_client" | "rebook",
    note?: string,
  ) => Promise<void>;
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

function parseMessageContent(text: string) {
  if (!text) return { body: '', jobDetails: null, systemSummary: null };

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
    return { body: '', jobDetails: null, systemSummary: entries };
  }

  // Detect "Job Details:" block
  const jobIdx = text.indexOf('Job Details:');
  if (jobIdx === -1) return { body: text, jobDetails: null, systemSummary: null };

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

  return { body, jobDetails: entries.length ? entries : null, systemSummary: null };
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
  const [disputeNote, setDisputeNote] = useState("");
  const [resolvingOutcome, setResolvingOutcome] = useState<string | null>(null);
  const [internalNoteText, setInternalNoteText] = useState("");
  const [sendingInternalNote, setSendingInternalNote] = useState(false);
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
    noteRequestIdRef.current += 1;
    messageRefs.current = {};
    setShowMobileDetails(false);
    setJobModalOpen(false);
    setJobModalLoading(false);
    setJobModalData(null);
    setDisputeNote("");
    setResolvingOutcome(null);
    setInternalNoteText("");
    setSendingInternalNote(false);
    setAcceptingTicket(false);
  }, [isOpen, selectedChat?._id]);

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
  const canManageTicket =
    isAdminUser &&
    (user?.role === "superadmin" || Boolean(selectedChat.acceptedBy));
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
    outcome: "pay_provider" | "refund_client" | "rebook",
  ) => {
    if (
      !canManageTicket ||
      !onResolveDispute ||
      !disputeJobId ||
      resolvingOutcome
    ) {
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
      );
      if (activeTicketIdRef.current === ticketId) {
        setDisputeNote("");
      }
    } catch (error) {
      console.error("Error resolving dispute:", error);
      if (activeTicketIdRef.current === ticketId) {
        alert("Failed to resolve dispute. Please try again.");
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

  const handleViewJobDetails = async () => {
    const jobId = getJobIdFromSnapshot();
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
          <div className="flex-shrink-0 px-4 py-3 md:px-6 md:py-5 border-b bg-white relative">
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

              {/* Desktop Header Content - Hidden on Mobile */}
              <div className="hidden md:block flex-1">
                <p className="text-sm text-gray-600 mb-1">
                  TICKET ID: {selectedChat.ticketId || selectedChat._id}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {selectedChat.subject}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(selectedChat.status, selectedChat.acceptedBy)}
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                    {selectedChat.category}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                {isDisputeTicket && counterpartChat && onSwitchChat && (
                  <button
                    data-testid="dispute-counterpart-switch-btn"
                    onClick={() => onSwitchChat(counterpartChat)}
                    title={`Open the ${counterpartChat.userType || "other party"}'s thread of this dispute`}
                    className="relative inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-full bg-purple-600 text-white shadow-sm hover:bg-purple-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden md:inline">
                      Switch to {counterpartChat.userType === "provider" ? "Provider" : "Client"}
                    </span>
                    <span className="md:hidden">
                      {counterpartChat.userType === "provider" ? "Provider" : "Client"}
                    </span>
                    {(counterpartChat.unreadCount || 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {counterpartChat.unreadCount}
                      </span>
                    )}
                  </button>
                )}
                {selectedChat.acceptedBy && hasJobId && (
                  <button
                    onClick={handleViewJobDetails}
                    disabled={jobModalLoading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Eye className="w-4 h-4" />
                    {jobModalLoading ? "Loading…" : "View Job Details"}
                  </button>
                )}
                {selectedChat.status === "open" &&
                  !selectedChat.acceptedBy &&
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
                              /^[✓⚡📋]\s*/,
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
                          className={`inline-block min-w-0 max-w-full rounded-2xl overflow-hidden text-left ${
                            isAdmin
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-900 shadow-sm"
                          } ${msg.imageUrl && !msg.message ? "" : "px-4 py-2.5"}`}
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
                                {parsed.body && (
                                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                                    {parsed.body}
                                  </p>
                                )}
                                {parsed.jobDetails && (
                                  <JobDetailsCard entries={parsed.jobDetails} isUser={isUser} />
                                )}
                                {!parsed.body && !parsed.jobDetails && (
                                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                                    {msg.message}
                                  </p>
                                )}
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

        {/* Column 2: User Information & Details Sidebar */}
        <div
          className={`flex flex-col h-full bg-gray-50 fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto md:w-[400px] border-l border-gray-300 min-h-0 overflow-hidden ${showMobileDetails ? "block" : "hidden md:block"}`}
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
            <div className="px-6 py-6">
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
                  const events = [];

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

            {/* Dispute threads — both parties keep their own thread with admin;
                mediate in each, then rule once. */}
            {isDisputeTicket && (
              <>
                <div className="border-t border-gray-300 my-4"></div>
                <div className="px-6 pb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Dispute Threads
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Each party has their own thread for this job. Talk to both
                    before ruling.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border border-purple-300 bg-purple-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-purple-900 truncate">
                          {selectedChat.userName || "This user"}
                        </p>
                        <p className="text-[11px] text-purple-700 capitalize">
                          {selectedChat.userType || "client"} — current thread
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-100 rounded-full px-2 py-1">
                        Viewing
                      </span>
                    </div>
                    {counterpartChat && onSwitchChat ? (
                      <button
                        data-testid="dispute-counterpart-open-btn"
                        onClick={() => onSwitchChat(counterpartChat)}
                        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {counterpartChat.userName || "Other party"}
                          </p>
                          <p className="text-[11px] text-gray-500 capitalize">
                            {counterpartChat.userType || "user"} — open their thread
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(counterpartChat.unreadCount || 0) > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                              {counterpartChat.unreadCount}
                            </span>
                          )}
                          <RefreshCw className="w-4 h-4 text-gray-400" />
                        </div>
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400 px-1">
                        The other party's thread isn't loaded — check the
                        Support inbox for the matching “{selectedChat.subject}”
                        ticket.
                      </p>
                    )}
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
                        data-testid="resolve-dispute-rebook"
                        onClick={() => handleResolveDispute("rebook")}
                        disabled={!!resolvingOutcome}
                        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {resolvingOutcome === "rebook" ? "Resolving…" : "Rebook"}
                      </button>
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

            {/* Actions - Visible on both Mobile and Desktop */}
          </div>

          {/* Sticky Footer Actions */}
          {canManageTicket &&
            (selectedChat.status === "open" ||
              selectedChat.status === "closed") && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50 z-[50]">
                {selectedChat.status === "open" ? (
                  <button
                    onClick={() => handleChatAction(selectedChat._id, "close")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all duration-200 text-sm font-medium"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Resolve Ticket
                  </button>
                ) : (
                  <button
                    onClick={() => handleChatAction(selectedChat._id, "reopen")}
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
