import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  Calendar,
  MessageCircleQuestion,
  Send
} from 'lucide-react';
import io from 'socket.io-client';
import '../styles/support.css';

const Support: React.FC = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchTickets();
    setupSocket();
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const setupSocket = () => {
    const newSocket = io('http://localhost:5000', {
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected');
    });
    
    newSocket.on('support:ticket_updated', (updatedTicket) => {
      setTickets(prev => prev.map(ticket => 
        ticket._id === updatedTicket._id ? updatedTicket : ticket
      ));
    });
    
    newSocket.on('support:new_ticket', () => {
      fetchTickets();
    });
    
    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    setSocket(newSocket);
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/support/tickets', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketAction = async (ticketId, action, resolution = null) => {
    try {
      const response = await fetch(`http://localhost:5000/api/support/tickets/${ticketId}/${action}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      });

      if (response.ok) {
        fetchTickets();
        if (selectedTicket?._id === ticketId) {
          const updatedResponse = await fetch(`http://localhost:5000/api/support/tickets/${ticketId}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          const updatedTicket = await updatedResponse.json();
          setSelectedTicket(updatedTicket.ticket);
        }
      }
    } catch (error) {
      console.error(`Error ${action} ticket:`, error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedTicket) return;

    try {
      const response = await fetch(`http://localhost:5000/api/support/tickets/${selectedTicket._id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() })
      });

      if (response.ok) {
        const updatedResponse = await fetch(`http://localhost:5000/api/support/tickets/${selectedTicket._id}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const updatedTicket = await updatedResponse.json();
        setSelectedTicket(updatedTicket.ticket);
        setMessage('');
        fetchTickets();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'accepted': case 'in_progress': return <MessageSquare className="w-3 h-3 text-blue-500" />;
      case 'resolved': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'rejected': case 'closed': return <XCircle className="w-3 h-3 text-red-500" />;
      default: return <AlertCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Header */}
      <div className="bg-white border-b px-6 py-3 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
        <p className="text-sm text-gray-600">Manage support tickets and help users</p>
      </div>

      {/* Main Content - Scrollable Area */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          {/* Tickets List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border flex flex-col h-full overflow-hidden">
            {/* Fixed Header Section */}
            <div className="p-3 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 w-full border bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <Filter className="w-4 h-4 text-gray-400" />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2 py-1.5 border bg-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 flex-1"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                  <option value="closed">Closed</option>
                </select>
                
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="px-2 py-1.5 border bg-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 flex-1"
                >
                  <option value="all">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Scrollable Tickets List */}
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar smooth-scroll">
              {filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                  <MessageCircleQuestion className="w-12 h-12 mb-4 text-gray-300" />
                  <p className="text-base font-medium">No tickets found</p>
                  <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredTickets.map(ticket => (
                    <div
                      key={ticket._id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
                        selectedTicket?._id === ticket._id 
                          ? 'bg-blue-50 shadow-sm ring-2 ring-blue-500' 
                          : 'bg-white hover:bg-gray-50 hover:shadow-sm'
                      }`}
                    >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm text-gray-900 truncate pr-2">
                        {ticket.title}
                      </h3>
                      {getStatusIcon(ticket.status)}
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {ticket.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs text-gray-500">
                        {ticket.ticketId}
                      </span>
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Details */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border flex flex-col h-full overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Ticket Header */}
              <div className="p-3 border-b bg-gray-50 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">
                      {selectedTicket.title}
                    </h2>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {selectedTicket.description}
                    </p>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {selectedTicket.userName || selectedTicket.userEmail || `User ID: ${selectedTicket.userId}`}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(selectedTicket.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(selectedTicket.status)}
                        {selectedTicket.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-2">
                    {selectedTicket.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleTicketAction(selectedTicket._id, 'accept')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleTicketAction(selectedTicket._id, 'reject')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    
                    {(selectedTicket.status === 'accepted' || selectedTicket.status === 'in_progress') && (
                      <button
                        onClick={() => {
                          const resolution = prompt('Enter resolution summary:');
                          if (resolution) {
                            handleTicketAction(selectedTicket._id, 'resolve', resolution);
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 min-h-0 custom-scrollbar smooth-scroll">
                <div className="space-y-4">
                  {selectedTicket.messages?.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.senderType === 'Admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.senderType === 'Admin' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-900 border'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${
                            msg.senderType === 'Admin' ? 'text-blue-100' : 'text-gray-600'
                          }`}>
                            {msg.senderName || (msg.senderType === 'Admin' ? 'Admin' : 'User')}
                          </span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-xs mt-1 ${
                          msg.senderType === 'Admin' ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(msg.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              {(selectedTicket.status === 'accepted' || selectedTicket.status === 'in_progress') && (
                <div className="p-4 border-t bg-white flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!message.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircleQuestion className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Ticket</h3>
                <p>Choose a support ticket from the list to view details and chat</p>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default Support;