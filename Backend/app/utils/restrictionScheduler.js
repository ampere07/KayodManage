const cron = require('node-cron');
const User = require('../models/User');

/**
 * Scheduler to automatically remove expired restrictions
 * Runs every hour to check for expired restrictions
 */
const startRestrictionScheduler = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Restriction Scheduler] Checking for expired restrictions...');
      
      const now = new Date();
      
      // Find users with expired restrictions
      const expiredUsers = await User.find({
        isRestricted: true,
        'restrictionDetails.expiresAt': { $lte: now }
      });
      
      console.log(`[Restriction Scheduler] Found ${expiredUsers.length} users with expired restrictions`);
      
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
          
          console.log(`[Restriction Scheduler] Removed expired restriction for user: ${user.name} (${user._id})`);
        } catch (error) {
          console.error(`[Restriction Scheduler] Error removing restriction for user ${user._id}:`, error);
        }
      }
      
      if (expiredUsers.length > 0) {
        console.log('[Restriction Scheduler] Completed processing expired restrictions');
      }
    } catch (error) {
      console.error('[Restriction Scheduler] Error in restriction scheduler:', error);
    }
  });
  
  console.log('[Restriction Scheduler] Scheduler started - Running every hour');
};

module.exports = { startRestrictionScheduler };
