import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ChatSideModal from './ChatSideModal';

interface Job {
  _id: string;
  title: string;
  description: string;
  user: {
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
  };
}

interface JobWithChatProps {
  job: Job;
}

const JobWithChat: React.FC<JobWithChatProps> = ({ job }) => {
  const [showChatModal, setShowChatModal] = useState(false);
  const [status, setStatus] = useState('Open');
  const [priority, setPriority] = useState('High');
  const [messages, setMessages] = useState([
    {
      _id: '1',
      sender: 'user',
      senderName: job.user.username,
      text: 'Hi, I need help with my booking. I can\'t seem to find my confirmation email anywhere.',
      timestamp: new Date('2024-12-25T10:00:00')
    },
    {
      _id: '2',
      sender: 'me',
      senderName: 'Support Agent',
      text: 'Hello! I\'d be happy to help you with your booking. Can you please provide me with your booking reference number?',
      timestamp: new Date('2024-12-25T10:02:00')
    },
    {
      _id: '3',
      sender: 'user',
      senderName: job.user.username,
      text: 'Sure, it\'s BK-2024-12345',
      timestamp: new Date('2024-12-25T10:05:00')
    },
    {
      _id: '4',
      sender: 'me',
      senderName: 'Support Agent',
      text: 'Thank you! I found your booking. I\'ll resend the confirmation email right away.',
      timestamp: new Date('2024-12-25T10:07:00')
    },
    {
      _id: '5',
      sender: 'user',
      senderName: job.user.username,
      text: 'Perfect! I just received it. Thank you so much for your help!',
      timestamp: new Date('2024-12-25T10:10:00')
    }
  ]);

  const handleSendMessage = (text: string) => {
    const newMessage = {
      _id: Date.now().toString(),
      sender: 'me',
      senderName: 'Support Agent',
      text,
      timestamp: new Date()
    };
    setMessages([...messages, newMessage]);
  };

  const handleReopen = () => {
    setStatus('Open');
    console.log('Ticket reopened');
  };

  const handleResolve = () => {
    setStatus('Resolved');
    console.log('Ticket resolved');
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    console.log('Status changed to:', newStatus);
  };

  const handlePriorityChange = (newPriority: string) => {
    setPriority(newPriority);
    console.log('Priority changed to:', newPriority);
  };

  const ticketDetails = {
    createdAt: 'Dec 25, 2024 10:00 AM',
    lastUpdate: 'Dec 25, 2024 10:10 AM',
    responseTime: '2 minutes',
    assignedTo: 'Support Team'
  };

  const activities = [
    {
      _id: 'a1',
      action: 'Ticket created',
      timestamp: 'Dec 25, 2024 at 10:00 AM'
    },
    {
      _id: 'a2',
      action: 'Assigned to Support Team',
      timestamp: 'Dec 25, 2024 at 10:01 AM'
    },
    {
      _id: 'a3',
      action: 'Status changed to In Progress',
      timestamp: 'Dec 25, 2024 at 10:02 AM'
    },
    {
      _id: 'a4',
      action: 'Confirmation email resent',
      timestamp: 'Dec 25, 2024 at 10:07 AM'
    },
    {
      _id: 'a5',
      action: 'Customer confirmed resolution',
      timestamp: 'Dec 25, 2024 at 10:10 AM'
    }
  ];

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
        <p className="text-gray-600 mb-4">{job.description}</p>

        <div className="flex justify-end">
          <button
            onClick={() => setShowChatModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Open Support Chat
          </button>
        </div>
      </div>

      <ChatSideModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        ticketId="TKT-12345"
        subject={job.title}
        status={status}
        priority={priority}
        category="Booking Support"
        userInfo={{
          ...job.user,
          firstName: job.user.firstName || job.user.username.split(' ')[0],
          lastName: job.user.lastName || job.user.username.split(' ').slice(1).join(' ') || 'N/A',
          userType: job.user.userType || 'Customer',
          memberSince: job.user.memberSince || 'Jan 2024',
          totalBookings: job.user.totalBookings || 0,
          ticketsSubmitted: job.user.ticketsSubmitted || 1
        }}
        messages={messages}
        ticketDetails={ticketDetails}
        activities={activities}
        onSendMessage={handleSendMessage}
        onReopen={handleReopen}
        onResolve={handleResolve}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
      />
    </>
  );
};

export default JobWithChat;
