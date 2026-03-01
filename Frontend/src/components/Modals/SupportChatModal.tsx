import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, CheckCircle, RefreshCw, MessageSquare, MoreVertical, ArrowLeft, Send, Eye } from 'lucide-react';
import { getStatusBadge } from '../../utils';
import UserTypeBadge from '../UI/UserTypeBadge';
import { useAuth } from '../../context/AuthContext';
import { jobsService } from '../../services';
import JobDetailsModal from './JobDetailsModal';

interface Message {
  _id?: string;
  senderType: 'Admin' | 'User';
  senderId?: string;
  senderName?: string;
  message: string;
  timestamp: string;
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
  status: 'open' | 'closed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
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
    status: 'resolved' | 'reopened';
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
  handleAcceptTicket: (chatSupportId: string) => void;
  chatSupports: ChatSupport[];
}

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
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

  return parts.join(' ');
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
  chatSupports
}) => {
  const { user } = useAuth();
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalLoading, setJobModalLoading] = useState(false);
  const [jobModalData, setJobModalData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add ring/border and scale-up effect (no background change to preserve readability)
      messageElement.style.transition = 'all 0.3s ease';
      messageElement.style.transform = 'scale(1.05)';
      messageElement.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(59, 130, 246, 0.3)';

      setTimeout(() => {
        messageElement.style.transform = 'scale(1)';
        messageElement.style.boxShadow = '';
      }, 2000);
    }
  };

  if (!isOpen || !selectedChat) return null;

  const getJobIdFromSnapshot = () => {
    const snapshot = selectedChat.jobDetailsSnapshot || selectedChat.metadata;
    if (!snapshot) return null;
    return snapshot.jobId || snapshot['Job ID'] || snapshot['jobId'];
  };

  const handleViewJobDetails = async () => {
    const jobId = getJobIdFromSnapshot();
    if (!jobId) {
      alert('Job ID not available for this ticket.');
      return;
    }

    try {
      setJobModalLoading(true);
      const data = await jobsService.getJobById(jobId);
      setJobModalData(data);
      setJobModalOpen(true);
    } catch (error) {
      console.error('Failed to load job details:', error);
      alert('Failed to load job details.');
    } finally {
      setJobModalLoading(false);
    }
  };

  const firstName = selectedChat.userName?.split(' ')[0] || '';
  const lastName = selectedChat.userName?.split(' ').slice(1).join(' ') || firstName;

  return ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[90] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 md:left-72 h-[100dvh] bg-white shadow-2xl z-[100] flex flex-col md:flex-row overflow-hidden">
        {/* Column 1: Chat Area */}
        <div className={`flex-1 flex flex-col min-h-0 ${showMobileDetails ? 'hidden md:flex' : 'flex'}`}>
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
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">TKT ID:</p>
                    <p className="text-sm font-bold text-gray-900">{selectedChat.ticketId || selectedChat._id.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedChat.status, selectedChat.acceptedBy)}
                  </div>
                </div>
              </div>

              {/* Desktop Header Content - Hidden on Mobile */}
              <div className="hidden md:block flex-1">
                <p className="text-sm text-gray-600 mb-1">TICKET ID: {selectedChat.ticketId || selectedChat._id}</p>
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
                {selectedChat.acceptedBy && (
                  <button
                    onClick={handleViewJobDetails}
                    disabled={jobModalLoading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Eye className="w-4 h-4" />
                    {jobModalLoading ? 'Loading…' : 'View Job Details'}
                  </button>
                )}
                {selectedChat.status === 'open' && !selectedChat.acceptedBy && (user?.role === 'admin' || user?.role === 'superadmin') && (
                  <button
                    onClick={() => handleAcceptTicket(selectedChat._id)}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                    Accept
                  </button>
                )}

                {/* Desktop Actions - Removed */}

                {/* Mobile Menu / Details Toggle */}
                <button
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
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6 min-h-0">
            {(!selectedChat.messages || selectedChat.messages.length === 0) ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-base font-medium text-gray-600">No messages yet</p>
                  <p className="text-sm text-gray-500">Start the conversation!</p>
                </div>
              </div>
            ) : (
              selectedChat.messages.map((msg, index) => {
                const isAdmin = msg.senderType === 'Admin';
                const currentDate = new Date(msg.timestamp);
                const previousDate = index > 0 ? new Date(selectedChat.messages![index - 1].timestamp) : null;

                // Check if this is a system message
                const isTicketSummary = msg.message.includes('PREVIOUS TICKET RESOLVED') || msg.message.includes('Previous Ticket Summary');
                const messageText = msg.message.toLowerCase();
                const isSystemMessage = !isTicketSummary && isAdmin && (
                  messageText.includes('ticket has been') ||
                  messageText.includes('chat has been') ||
                  messageText.includes('ticket reopened') ||
                  messageText.includes('chat reopened')
                );

                const showDateSeparator = !previousDate ||
                  currentDate.toDateString() !== previousDate.toDateString();

                const getDateLabel = (date: Date) => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);

                  if (date.toDateString() === today.toDateString()) {
                    return 'Today';
                  } else if (date.toDateString() === yesterday.toDateString()) {
                    return 'Yesterday';
                  } else {
                    return date.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  }
                };

                const previousMsg = index > 0 ? selectedChat.messages![index - 1] : null;
                const nextMsg = index < selectedChat.messages!.length - 1 ? selectedChat.messages![index + 1] : null;

                const isGroupedWithPrevious = previousMsg &&
                  previousMsg.senderType === msg.senderType &&
                  (currentDate.getTime() - new Date(previousMsg.timestamp).getTime()) < 5 * 60 * 1000 &&
                  currentDate.toDateString() === new Date(previousMsg.timestamp).toDateString();

                const isGroupedWithNext = nextMsg &&
                  nextMsg.senderType === msg.senderType &&
                  (new Date(nextMsg.timestamp).getTime() - currentDate.getTime()) < 5 * 60 * 1000 &&
                  currentDate.toDateString() === new Date(nextMsg.timestamp).toDateString();

                const showSenderName = !isGroupedWithPrevious;
                const showTimestamp = !isGroupedWithNext;

                // Determine if this is a special message (resolved, reopened, accepted)
                const isResolvedMessage = messageText.includes('resolved') || messageText.includes('closed');
                const isReopenedMessage = messageText.includes('reopened');
                const isFirstAdminMessage = isAdmin && !selectedChat.messages!.slice(0, index).some(m => m.senderType === 'Admin');

                // Generate a unique ID for special messages
                let messageId = msg._id || `msg-${index}`;
                if (isFirstAdminMessage) messageId = 'first-admin-message';
                if (isResolvedMessage) messageId = `resolved-${msg.timestamp}`;
                if (isReopenedMessage) messageId = `reopened-${msg.timestamp}`;

                // Render ticket summary message differently
                if (isTicketSummary) {
                  const parseSummary = (text: string) => {
                    const sections = text.split(/(?=✓|⚡)/).filter(s => s.trim());
                    return sections.map(section => {
                      const lines = section.split('\n').filter(l => l.trim());
                      const title = lines[0];
                      const details: { [key: string]: string } = {};

                      lines.slice(1).forEach(line => {
                        const colonIndex = line.indexOf(':');
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
                      <div className="flex items-center justify-center my-6">
                        <div className="max-w-2xl w-full space-y-4">
                          {sections.map((section, sectionIndex) => {
                            const isResolved = section.title.includes('✓');
                            const isNewTicket = section.title.includes('⚡');

                            return (
                              <div
                                key={sectionIndex}
                                className={`rounded-lg border-2 p-5 ${isResolved
                                  ? 'bg-green-50 border-green-300'
                                  : isNewTicket
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-gray-50 border-gray-300'
                                  }`}
                              >
                                <div className="mb-4">
                                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                                    {section.title.replace(/^[✓⚡📋]\s*/, '')}
                                  </h3>
                                </div>

                                {Object.keys(section.details).length > 0 && (
                                  <div className="space-y-2.5">
                                    {Object.entries(section.details).map(([key, value], detailIndex) => (
                                      <div key={detailIndex} className="flex justify-between items-start">
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                          {key}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 text-right max-w-xs">
                                          {value}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <div className="text-center">
                            <p className="text-xs text-gray-500">
                              {new Date(msg.timestamp).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })} at {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                // Render system message differently
                if (isSystemMessage) {
                  // Check if this is a resolved/closed message
                  const isResolvedOrClosed = messageText.includes('resolved') || messageText.includes('closed');

                  if (isResolvedOrClosed) {
                    // Display as a centered message like image 2
                    const adminName = msg.senderName || 'admin';
                    return (
                      <React.Fragment key={msg._id || index}>
                        <div className="flex items-center justify-center my-3">
                          <div className="flex flex-col items-center">
                            <div
                              ref={(el) => { messageRefs.current[messageId] = el; }}
                              className="text-sm text-gray-600 font-medium"
                            >
                              Ticket resolved by {adminName}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
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
                            ref={(el) => { messageRefs.current[messageId] = el; }}
                            className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full"
                          >
                            {msg.message.replace(/^(Chat has been reopened|Ticket has been resolved|Ticket has been closed|Ticket has been accepted)/, (match) => {
                              const sender = msg.senderName || 'superadmin';
                              return match.replace('Chat has been', `Chat reopened by ${sender}`)
                                .replace('Ticket has been resolved', `Ticket resolved by ${sender}`)
                                .replace('Ticket has been closed', `Ticket closed by ${sender}`)
                                .replace('Ticket has been accepted', `Ticket accepted by ${sender}`);
                            })}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {(() => {
                              const messageDate = new Date(msg.timestamp);
                              const today = new Date();
                              const isToday = messageDate.toDateString() === today.toDateString();

                              if (isToday) {
                                return messageDate.toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                });
                              } else {
                                return messageDate.toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
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
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} ${isGroupedWithNext ? 'mb-1' : 'mb-3'}`}
                    >
                      {!isAdmin && (
                        selectedChat.userProfileImage ? (
                          <img
                            src={selectedChat.userProfileImage}
                            alt={selectedChat.userName || 'User'}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 mr-2 mt-1"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                            <span className="text-xs font-semibold text-gray-700">
                              {getInitials(selectedChat.userName || 'User')}
                            </span>
                          </div>
                        )
                      )}
                      <div className={`max-w-sm ${isAdmin ? 'text-right' : 'text-left'
                        }`}>
                        <div
                          ref={(el) => { messageRefs.current[messageId] = el; }}
                          className={`inline-block px-4 py-2.5 rounded-2xl ${isAdmin
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-900 shadow-sm'
                            }`}>
                          <p className="text-sm leading-relaxed">{msg.message}</p>
                        </div>
                        {showTimestamp && (
                          <p className={`text-xs mt-1 px-1 ${isAdmin ? 'text-gray-500 text-right' : 'text-gray-500 text-left'
                            }`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 ml-2 mt-1">
                          <span className="text-xs font-semibold text-white">
                            {getInitials(msg.senderName || 'Admin')}
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
          {selectedChat.status === 'open' ? (
            !selectedChat.acceptedBy ? (
              <div className="flex-shrink-0 p-6 bg-gray-100 border-t">
                <div className="flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-600">You must accept this ticket before sending messages</p>
                </div>
              </div>
            ) : (user?.role !== 'admin' && user?.role !== 'superadmin') ? (
              <div className="flex-shrink-0 p-6 bg-gray-100 border-t">
                <div className="flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-600">Only admins can send messages to tickets</p>
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
                      if (e.key === 'Enter' && !sendingMessage) {
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
                <p className="text-sm font-medium text-gray-600">Ticket has been resolved</p>
              </div>
            </div>
          )}
        </div>

        {/* Column 2: User Information & Details Sidebar */}
        <div className={`flex flex-col h-full bg-gray-50 fixed inset-0 z-[110] md:relative md:inset-auto md:z-auto md:w-[400px] border-l border-gray-300 min-h-0 overflow-hidden ${showMobileDetails ? 'block' : 'hidden md:block'}`}>
          {/* Header with Close Button */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileDetails(false)}
                className="md:hidden p-1 -ml-1 text-gray-600 hover:bg-gray-200 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-bold text-gray-900">User Information</h3>
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
                    alt={selectedChat.userName || 'User'}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-gray-600">
                      {getInitials(selectedChat.userName || selectedChat.userEmail || 'Unknown')}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">{selectedChat.userName || 'Username'}</p>
                  <p className="text-sm text-gray-600 mt-1">{selectedChat.userEmail || 'Email'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">First Name: </span>
                    <span className="text-sm font-semibold text-gray-900">{firstName}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Last Name: </span>
                    <span className="text-sm font-semibold text-gray-900">{lastName}</span>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">User Type: </span>
                  <UserTypeBadge userType={selectedChat.userType || 'client'} />
                </div>
                <div>
                  <span className="text-sm text-gray-600">Member Since: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {new Date(selectedChat.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Bookings: </span>
                  <span className="text-sm font-semibold text-gray-900">0</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Tickets Submitted: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {chatSupports.filter(chat => chat.userId === selectedChat.userId).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 my-4"></div>

            {/* Ticket Details */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ticket Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Ticket ID: </span>
                  <span className="text-sm font-semibold text-gray-900">{selectedChat.ticketId || selectedChat._id}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Created At: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {new Date(selectedChat.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Last Update: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.updatedAt ? new Date(selectedChat.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Response Time: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.acceptedAt
                      ? formatResponseTime(Math.round((new Date(selectedChat.acceptedAt).getTime() - new Date(selectedChat.createdAt).getTime()) / (1000 * 60)))
                      : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Assigned To: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedChat.assignedToName || selectedChat.acceptedByName || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 my-4"></div>

            {/* Activity History */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Activity History</h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {(() => {
                  const events = [];

                  // 1. Ticket Submitted
                  const firstUserMessage = selectedChat.messages?.[0];
                  events.push({
                    type: 'submitted',
                    title: 'Ticket Submitted',
                    date: selectedChat.createdAt,
                    timestamp: new Date(selectedChat.createdAt).getTime(),
                    messageId: firstUserMessage ? (firstUserMessage._id || 'msg-0') : null
                  });

                  // 2. Ticket Accepted (based on first admin response)
                  const firstAdminMessage = selectedChat.messages?.find(msg => msg.senderType === 'Admin');
                  if (firstAdminMessage) {
                    events.push({
                      type: 'accepted',
                      title: 'Ticket Accepted',
                      date: firstAdminMessage.timestamp,
                      timestamp: new Date(firstAdminMessage.timestamp).getTime(),
                      messageId: 'first-admin-message'
                    });
                  }

                  // 3. All status history events (resolved and reopened)
                  if (selectedChat.statusHistory && selectedChat.statusHistory.length > 0) {
                    selectedChat.statusHistory.forEach((historyItem, historyIndex) => {
                      // Find the corresponding message for this status change
                      let correspondingMessage = null;

                      if (historyItem.status === 'resolved') {
                        // Find messages with 'resolved' or 'closed' text near this timestamp
                        const historyTime = new Date(historyItem.timestamp).getTime();
                        correspondingMessage = selectedChat.messages?.find(msg => {
                          const msgText = msg.message.toLowerCase();
                          const msgTime = new Date(msg.timestamp).getTime();
                          const timeDiff = Math.abs(msgTime - historyTime);
                          return msg.senderType === 'Admin' &&
                            (msgText.includes('resolved') || msgText.includes('closed')) &&
                            timeDiff < 5000; // Within 5 seconds
                        });
                      } else if (historyItem.status === 'reopened') {
                        // Find messages with 'reopened' text near this timestamp
                        const historyTime = new Date(historyItem.timestamp).getTime();
                        correspondingMessage = selectedChat.messages?.find(msg => {
                          const msgText = msg.message.toLowerCase();
                          const msgTime = new Date(msg.timestamp).getTime();
                          const timeDiff = Math.abs(msgTime - historyTime);
                          return msg.senderType === 'Admin' &&
                            msgText.includes('reopened') &&
                            timeDiff < 5000; // Within 5 seconds
                        });
                      }

                      const messageId = correspondingMessage
                        ? `${historyItem.status}-${correspondingMessage.timestamp}`
                        : null;

                      events.push({
                        type: historyItem.status,
                        title: historyItem.status === 'resolved' ? 'Ticket has been resolved' : 'Ticket Reopened',
                        date: historyItem.timestamp,
                        timestamp: new Date(historyItem.timestamp).getTime(),
                        reason: historyItem.reason,
                        messageId: messageId
                      });
                    });
                  }

                  // Sort events by timestamp
                  events.sort((a, b) => a.timestamp - b.timestamp);

                  // Render events
                  return events.map((event, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${event.messageId ? 'cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded transition-colors' : ''
                        }`}
                      onClick={() => event.messageId && scrollToMessage(event.messageId)}
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 border-2 border-gray-400 rounded-full bg-white"></div>
                        {index < events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-300 mt-1 min-h-[32px]"></div>
                        )}
                      </div>
                      <div className={`flex-1 ${index < events.length - 1 ? 'pb-2' : ''}`}>
                        <p className="text-sm font-medium text-gray-900">{event.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Date: {new Date(event.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
            {/* Actions - Visible on both Mobile and Desktop */}
          </div>

          {/* Sticky Footer Actions */}
          {((selectedChat.status === 'open' && selectedChat.acceptedBy) || selectedChat.status === 'closed') && (user?.role === 'admin' || user?.role === 'superadmin') && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50 z-[50]">
              {selectedChat.status === 'open' ? (
                <button
                  onClick={() => handleChatAction(selectedChat._id, 'close')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all duration-200 text-sm font-medium"
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolve Ticket
                </button>
              ) : (
                <button
                  onClick={() => handleChatAction(selectedChat._id, 'reopen')}
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
    document.body
  );
};

export default SupportChatModal;
