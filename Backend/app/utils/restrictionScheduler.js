const cron = require('node-cron');
const User = require('../models/User');
const { logger } = require('./logger');
const { runWithNewRequestId } = require('./requestContext');

/**
 * Scheduler to automatically remove expired restrictions
 * Runs every hour to check for expired restrictions
 */
const startRestrictionScheduler = () => {
  // Run every hour
  cron.schedule('0 * * * *', () => runWithNewRequestId(async () => {
    try {
      const now = new Date();
      
      // Find users with expired restrictions
      const expiredUsers = await User.find({
        isRestricted: true,
        'restrictionDetails.expiresAt': { $lte: now }
      });
      
      for (const user of expiredUsers) {
        try {
          // Remove restriction
          await User.findByIdAndUpdate(
            user._id,
            { 
              accountStatus: 'active',
              isRestricted: false,
              $unset: { restrictionDetails: 1 }
            }
          );
          
          logger.info('Expired restriction removed', { userId: String(user._id) });
        } catch (error) {
          logger.error('Failed to remove expired restriction', { userId: String(user._id), err: error });
        }
      }
    } catch (error) {
      logger.error('Restriction expiry run failed', { err: error });
    }
  }));

  logger.info('Restriction expiry scheduler started', { schedule: '0 * * * *' });
};

module.exports = { startRestrictionScheduler };
