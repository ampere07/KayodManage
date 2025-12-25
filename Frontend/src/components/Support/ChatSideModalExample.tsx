import React, { useState } from 'react';
import ChatSideModal from './ChatSideModal';
import { ChatSupport } from '../../types/support.types';
import { User } from '../../types/users.types';

/**
 * Example Usage of ChatSideModal Component
 * 
 * This file demonstrates how to use the ChatSideModal component in your application.
 */

const ChatSideModalExample: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Example ticket data
  const exampleTicket: ChatSupport = {
    _id: 'TKT-2024-001',
    userId: 'user123',
    userEmail: 'john.doe@example.com',
    userName: 'John Doe',
    subject: 'Unable to complete booking process',
    category: 'Technical',
    description: 'I am having issues completing my booking',
    status: 'open',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        _id: 'msg1',
        senderType: 'User',
        senderId: 'user123',
        senderName: 'John Doe',
        message: 'I am having issues completing my booking. The payment page keeps loading.',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        _id: 'msg2',
        senderType: 'Admin',
        senderId: 'admin123',
        senderName: 'Support Team',
        message: 'Thank you for reaching out. I will look into this issue right away.',
        timestamp: new Date(Date.now() - 1800000).toISOString()
      }
    ],
    assignedTo: 'Support Team'
  };

  // Example user data
  const exampleUser: User = {
    _id: 'user123',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    location: 'New York, USA',
    categories: ['Technology'],
    userType: 'client',
    isVerified: true,
    isRestricted: false,
    isOnline: true,
    accountStatus: 'active',
    wallet: {
      balance: 1000,
      availableBalance: 1000,
      heldBalance: 0,
      currency: 'USD',
      isActive: true,
      isVerified: true
    },
    fees: [],
    createdAt: new Date('2023-01-15')
  };

  // Handler for sending messages
  const handleSendMessage = async (message: string) => {
    try {
      // Replace this with your actual API call
      console.log('Sending message:', message);
      
      // Example API call:
      // const response = await fetch(`/api/support/tickets/${ticket._id}/messages`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message })
      // });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add the new message to the ticket (this should be done by your backend)
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  // Handler for resolving tickets
  const handleResolveTicket = async () => {
    try {
      // Replace this with your actual API call
      console.log('Resolving ticket:', exampleTicket._id);
      
      // Example API call:
      // const response = await fetch(`/api/support/tickets/${ticket._id}/resolve`, {
      //   method: 'PUT'
      // });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Ticket resolved successfully');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to resolve ticket:', error);
      throw error;
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Chat Side Modal Example</h1>
      
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Open Chat Modal
      </button>

      <ChatSideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ticket={exampleTicket}
        user={exampleUser}
        onSendMessage={handleSendMessage}
        onResolveTicket={handleResolveTicket}
      />
    </div>
  );
};

export default ChatSideModalExample;
