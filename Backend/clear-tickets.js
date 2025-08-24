// Script to clear all support tickets from the database
// USE WITH CAUTION - This will delete all support tickets!

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/kayod-admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', async () => {
  console.log('✅ Connected to MongoDB');
  
  rl.question('⚠️  This will DELETE ALL support tickets. Are you sure? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      await clearTickets();
    } else {
      console.log('❌ Operation cancelled');
    }
    rl.close();
    process.exit(0);
  });
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

async function clearTickets() {
  try {
    const SupportTicket = require('./app/models/SupportTicket');
    
    const count = await SupportTicket.countDocuments();
    console.log(`Found ${count} tickets to delete`);
    
    if (count > 0) {
      const result = await SupportTicket.deleteMany({});
      console.log(`✅ Deleted ${result.deletedCount} tickets`);
    } else {
      console.log('No tickets to delete');
    }
  } catch (error) {
    console.error('❌ Error clearing tickets:', error);
  }
}
