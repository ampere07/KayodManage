import React, { useState, useRef, useEffect } from 'react';
import { X, Send, User, Calendar, Clock, AlertCircle } from 'lucide-react';
import { ChatSupport, Message } from '../../types/support.types';
import { User as UserType } from '../../types/users.types';

interface ChatSideModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ChatSupport | null;
  user: UserType | null;
  onSendMessage: (message: string) => Promise<void>;
  onResolveTicket?: () => Promise<void>;
}

const ChatSideModal: React.FC<ChatSideModalProps> = ({
  isOpen,
  onClose,
  ticket,
  user,
  onSendMessage,
  onResolveTicket
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      scrollToBottom();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, ticket?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(message);
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority as keyof typeof colors] || colors.low;
  };

  const getStatusColor = (status: string) => {
    return status === 'open' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-gray-100 text-gray-800';
  };

  if (!isOpen || !ticket) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed top-0 right-0 h-full w-full max-w-6xl bg-white shadow-2xl z-50 flex">
        
        {/* Column 1: Chat Area */}
        <div className="flex-1 flex flex-col border-r border-gray-200">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500">TICKET ID: {ticket._id}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-1">
                  SUBJECT: {ticket.subject}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {ticket.category}
              </span>
            </div>

            {ticket.status === 'open' && onResolveTicket && (
              <button
                onClick={onResolveTicket}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                ✓ Resolve
              </button>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {ticket.messages && ticket.messages.length > 0 ? (
              ticket.messages.map((msg, index) => (
                <div
                  key={msg._id || index}
                  className={`flex ${msg.senderType === 'Admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-3 rounded-lg ${
                      msg.senderType === 'Admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm font-medium mb-1">
                      {msg.senderName || msg.senderType}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-xs mt-2 ${
                      msg.senderType === 'Admin' ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      {formatDate(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                No messages yet
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {ticket.status === 'open' && (
            <div className="p-6 border-t border-gray-200 bg-white">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Write a message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSending}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Column 2: User Information */}
        <div className="w-96 bg-white overflow-y-auto">
          
          {/* User Information Section */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Information</h3>
            
            {user ? (
              <>
                <div className="flex flex-row items-start gap-4 mb-6">
                  {user.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt={user.name}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="font-semibold text-gray-900 text-base">{user.name}</p>
                    <p className="text-sm text-gray-600 mt-1 break-words">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">First Name</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {user.name.split(' ')[0]}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Last Name</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {user.name.split(' ').slice(1).join(' ') || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">User Type:</p>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {user.userType || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Member Since:</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Bookings:</p>
                    <p className="text-sm font-semibold text-gray-900">
                      0
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tickets Submitted:</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {user.fees?.length || 0}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-4">
                User information not available
              </div>
            )}
          </div>

          {/* Ticket Details Section */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Details</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ticket ID:</p>
                <p className="text-sm font-semibold text-gray-900">{ticket._id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Created At:</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(ticket.createdAt)}
                </p>
              </div>
              {ticket.updatedAt && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Last Update:</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(ticket.updatedAt)}
                  </p>
                </div>
              )}
              {ticket.assignedTo && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Assigned To:</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {ticket.assignedTo}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Ticket Submitted</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Date: {formatDate(ticket.createdAt)}
                  </p>
                </div>
              </div>

              {ticket.closedAt && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Ticket Resolved</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Date: {formatDate(ticket.closedAt)}
                    </p>
                  </div>
                </div>
              )}

              {ticket.acceptedAt && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Ticket Accepted</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Date: {formatDate(ticket.acceptedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatSideModal;
