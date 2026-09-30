const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { getMongoUri } = require('./mongoUri');
const { logger } = require('../utils/logger');

dotenv.config();

const connectDatabase = async () => {
  try {
    const mongoUri = getMongoUri();
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2
    });


    logger.info('MongoDB connected', { database: mongoose.connection.name });
  } catch (error) {
    logger.error('MongoDB connection failed', { err: error });
    process.exit(1);
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    logger.error('MongoDB disconnect failed', { err: error });
  }
};

// Handle connection events
mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection error', { err: error });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = { connectDatabase, disconnectDatabase };