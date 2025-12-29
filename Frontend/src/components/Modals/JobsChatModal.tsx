import React, { useState, useEffect, useRef } from 'react';
import { X, MoreVertical, RotateCcw, Check } from 'lucide-react';

interface UserInfo {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
  memberSince?: string;
  totalBookings?: number;
  ticketsSubmitted?: number;
  avatar?: string;
}

interface Message {
  _id: string;
  sender: string;
  senderName?: string;
  text: string;
  timestamp: Date;
}

interface TicketDetails {
  createdAt: string;
  lastUpdate: string;
  responseTime: string;
  assignedTo: string;
}

interface Activity {
  _id: string;
  action: string;
  timestamp: string;
}

interface ChatSideModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  userInfo: UserInfo;
  messages?: Message[];
  ticketDetails: TicketDetails;
  activities: Activity[];
  onSendMessage: (message: string) => void;
  onReopen?: () => void;
  onResolve?: () => void;
  onStatusChange?: (status: string) => void;
  onPriorityChange?: (priority: string) => void;
}

const ChatSideModal: React.FC<ChatSideModalProps> = ({
  isOpen,
  onClose,
  ticketId,
  subject,
  status,
  priority,
  category,
  userInfo,
  messages = [],
  ticketDetails,
  activities,
  onSendMessage,
  onReopen,
  onResolve,
  onStatusChange,
  onPriorityChange
}) => {
  const [messageText, setMessageText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'resolved' || statusLower === 'closed') return 'bg-green-100 text-green-700';
    if (statusLower === 'open' || statusLower === 'pending') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const priorityLower = priority.toLowerCase();
    if (priorityLower === 'high' || priorityLower === 'urgent') return 'bg-red-100 text-red-700';
    if (priorityLower === 'medium') return 'bg-yellow-100 text-yellow-700';
    if (priorityLower === 'low') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  const groupMessagesByDate = () => {
    const grouped: { [key: string]: Message[] } = {};
    messages.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(msg);
    });
    return grouped;
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (!isOpen) return null;

  const groupedMessages = groupMessagesByDate();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40"
        onClick={onClose}
      />

      {/* Side Modal */}
      <div 
        className="fixed top-0 right-0 h-full max-w-6xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex"
        style={{ 
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        {/* Column 1 - Left side with 2 rows */}
        <div className="flex-1 grid grid-rows-[auto_1fr] border-r">
          {/* Row 1 - Header/Top Section */}
          <div className="border-b p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">TICKET ID: {ticketId}</div>
                <div className="text-2xl font-bold text-gray-900 mb-4">SUBJECT: {subject}</div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full flex items-center gap-1 ${getStatusColor(status)}`}>
                    {status.toLowerCase() === 'resolved' && <span className="text-green-700">✓</span>}
                    {status}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(priority)}`}>
                    {priority}
                  </span>
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                    {category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {status.toLowerCase() !== 'resolved' ? (
                  <button
                    onClick={() => onResolve && onResolve()}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-400 rounded hover:bg-gray-50 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    <span>Resolve</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onReopen && onReopen()}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-400 rounded hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Reopen</span>
                  </button>
                )}
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <MoreVertical className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2 - Main Content Area */}
          <div className="flex flex-col">
            <div className="flex-1 p-6 bg-gray-50 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-center">No messages yet</p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date} className="mb-6">
                    <div className="text-center mb-4">
                      <span className="text-sm text-gray-500">{date}</span>
                    </div>
                    <div className="space-y-4">
                      {msgs.map((message) => (
                        <div
                          key={message._id}
                          className={`flex ${
                            message.sender === 'me' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.sender !== 'me' && (
                            <div className="flex flex-col max-w-[70%]">
                              <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  {message.senderName || userInfo.username}
                                </p>
                                <p className="text-sm text-gray-700">{message.text}</p>
                              </div>
                              <span className="text-xs text-gray-500 mt-1 ml-4">
                                {new Date(message.timestamp).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                          )}
                          {message.sender === 'me' && (
                            <div className="flex flex-col items-end max-w-[70%]">
                              <div className="bg-blue-600 rounded-lg px-4 py-3 shadow-sm">
                                <p className="text-sm font-semibold text-white mb-1">
                                  {message.senderName || 'Support Agent'}
                                </p>
                                <p className="text-sm text-white">{message.text}</p>
                              </div>
                              <span className="text-xs text-gray-500 mt-1 mr-4">
                                {new Date(message.timestamp).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input at Bottom */}
            <div className="p-4 bg-white border-t flex gap-3">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit(e);
                  }
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!messageText.trim()}
                className="px-6 py-2 border border-gray-400 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Column 2 - Right Sidebar */}
        <div className="w-96 bg-gray-100 overflow-y-auto">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">User Information</h2>
              <button 
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Profile */}
            <div className="flex flex-col items-center mb-6">
              {userInfo.avatar ? (
                <img
                  src={userInfo.avatar}
                  alt={userInfo.username}
                  className="w-16 h-16 rounded-full object-cover bg-gray-300 mb-2"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-300 rounded-full mb-2 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600">
                    {getInitials(userInfo.username)}
                  </span>
                </div>
              )}
              <div className="text-sm font-bold text-gray-900">{userInfo.username}</div>
              <div className="text-sm text-gray-600">{userInfo.email}</div>
            </div>

            {/* User Details */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between gap-2">
                <div>
                  <span className="text-sm text-gray-600">First Name:</span>
                  <div className="text-sm font-semibold text-gray-900">{userInfo.firstName || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Last Name:</span>
                  <div className="text-sm font-semibold text-gray-900">{userInfo.lastName || 'N/A'}</div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">User Type:</span>
                <span className="text-sm font-semibold text-gray-900">{userInfo.userType || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Member Since:</span>
                <span className="text-sm font-semibold text-gray-900">{userInfo.memberSince || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Bookings:</span>
                <span className="text-sm font-semibold text-gray-900">{userInfo.totalBookings || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tickets Submitted:</span>
                <span className="text-sm font-semibold text-gray-900">{userInfo.ticketsSubmitted || 0}</span>
              </div>
            </div>

            {/* Ticket Details */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Ticket Details</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ticket ID:</span>
                  <span className="font-semibold text-gray-900">{ticketId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created At:</span>
                  <span className="font-semibold text-gray-900">{ticketDetails.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Update:</span>
                  <span className="font-semibold text-gray-900">{ticketDetails.lastUpdate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Response Time:</span>
                  <span className="font-semibold text-gray-900">{ticketDetails.responseTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned To:</span>
                  <span className="font-semibold text-gray-900">{ticketDetails.assignedTo}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Recent activity</h3>
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity._id} className="flex gap-2">
                    <div className="flex flex-col items-center">
                      <div className="w-4 h-4 border-2 border-gray-400 rounded-full mt-0.5 bg-white"></div>
                      {index < activities.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-300 mt-1"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="text-sm text-gray-900 font-medium">{activity.action}</div>
                      <div className="text-xs text-gray-500">{activity.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatSideModal;
