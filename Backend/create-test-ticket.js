// Script to create a test support ticket

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/kayod-admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', async () => {
  console.log('✅ Connected to MongoDB');
  await createTestTicket();
  process.exit(0);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

async function createTestTicket() {
  try {
    const SupportTicket = require('./app/models/SupportTicket');
    
    const testTicket = new SupportTicket({
      userId: 'test-user-123',
      userEmail: 'testuser@example.com',
      userName: 'Test User',
      userType: 'User',
      title: 'Test Support Ticket',
      description: 'This is a test ticket to verify the system is working correctly after fixing the ObjectId issue.',
      category: 'technical',
      priority: 'medium',
      status: 'pending'
    });
    
    const savedTicket = await testTicket.save();
    
    console.log('✅ Test ticket created successfully!');
    console.log('Ticket ID:', savedTicket.ticketId);
    console.log('MongoDB ID:', savedTicket._id);
    console.log('\nYou can now:');
    console.log('1. View this ticket in the KayodManage admin panel');
    console.log('2. Accept the ticket to test the admin assignment');
    console.log('3. Send messages to test the chat functionality');
    
  } catch (error) {
    console.error('❌ Error creating test ticket:', error);
  }
}
