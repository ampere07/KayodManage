const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority'
    });

    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error.message);
  }
};

// Handle connection events
mongoose.connection.on('error', (error) => {
  console.error('❌ Mongoose error:', error.message);
});

module.exports = { connectDatabase, disconnectDatabase };