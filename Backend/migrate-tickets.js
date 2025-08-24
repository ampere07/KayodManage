// Migration script to update existing support tickets
// Run this once to fix any existing tickets with ObjectId assignedAdmin fields

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/kayod-admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', async () => {
  console.log('✅ Connected to MongoDB');
  await migrateTickets();
  process.exit(0);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

async function migrateTickets() {
  try {
    const SupportTicket = require('./app/models/SupportTicket');
    
    // Find all tickets
    const tickets = await SupportTicket.find({});
    console.log(`Found ${tickets.length} tickets to check`);
    
    let updated = 0;
    for (const ticket of tickets) {
      let needsUpdate = false;
      
      // Check if assignedAdmin is an ObjectId and convert to string
      if (ticket.assignedAdmin && typeof ticket.assignedAdmin === 'object') {
        ticket.assignedAdmin = ticket.assignedAdmin.toString();
        needsUpdate = true;
      }
      
      // Add default assignedAdminName if missing
      if (ticket.assignedAdmin && !ticket.assignedAdminName) {
        ticket.assignedAdminName = 'Admin';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await ticket.save();
        updated++;
        console.log(`Updated ticket ${ticket.ticketId}`);
      }
    }
    
    console.log(`✅ Migration complete. Updated ${updated} tickets`);
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}
