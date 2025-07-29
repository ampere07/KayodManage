const User = require('../models/User');
const Wallet = require('../models/Wallet');
const FeeRecord = require('../models/FeeRecord');

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const search = req.query.search;
    const status = req.query.status;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status === 'verified') {
      query.isVerified = true;
    } else if (status === 'restricted') {
      query.accountStatus = { $in: ['restricted', 'suspended', 'banned'] };
    } else if (status === 'online') {
      query.isOnline = true;
    } else if (status === 'banned') {
      query.accountStatus = 'banned';
    } else if (status === 'suspended') {
      query.accountStatus = 'suspended';
    } else if (status === 'active') {
      query.accountStatus = 'active';
    }
    
    // Fetch users first
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`Found ${users.length} users`); // Debug log

    // Get all user IDs
    const userIds = users.map(user => user._id);
    
    // Fetch wallets for these users
    const wallets = await Wallet.find({ user: { $in: userIds } }).lean();
    console.log(`Found ${wallets.length} wallets`); // Debug log

    // Fetch fee records for these users  
    const feeRecords = await FeeRecord.find({ provider: { $in: userIds } }).lean();
    console.log(`Found ${feeRecords.length} fee records`); // Debug log
    
    // Create lookup maps
    const walletMap = {};
    wallets.forEach(wallet => {
      walletMap[wallet.user.toString()] = wallet;
    });

    const feeMap = {};
    feeRecords.forEach(fee => {
      const providerId = fee.provider.toString();
      if (!feeMap[providerId]) {
        feeMap[providerId] = [];
      }
      feeMap[providerId].push(fee);
    });

    // Combine data for each user
    const usersWithData = users.map(user => {
      const userId = user._id.toString();
      const wallet = walletMap[userId];
      const userFees = feeMap[userId] || [];
      
      console.log(`User ${user.name}: wallet=${!!wallet}, fees=${userFees.length}`); // Debug log
      
      // Create wallet data structure
      const walletData = {
        balance: wallet ? wallet.balance : 0,
        availableBalance: wallet ? wallet.availableBalance : 0,
        heldBalance: wallet ? wallet.heldBalance : 0,
        currency: wallet ? wallet.currency : 'PHP',
        isActive: wallet ? wallet.isActive : false,
        isVerified: wallet ? wallet.isVerified : false
      };

      // Transform fee records
      const feesData = userFees.map(fee => ({
        _id: fee._id,
        amount: fee.amount,
        dueDate: fee.dueDate,
        isPaid: fee.status === 'paid',
        status: fee.status,
        paymentMethod: fee.paymentMethod,
        createdAt: fee.createdAt
      }));

      return {
        ...user,
        wallet: walletData,
        fees: feesData
      };
    });
    
    const total = await User.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    res.json({
      users: usersWithData,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const getUserWithData = async (userId) => {
  try {
    // Fetch user
    const user = await User.findById(userId).lean();
    if (!user) return null;

    // Fetch wallet
    const wallet = await Wallet.findOne({ user: userId }).lean();
    
    // Fetch fee records
    const feeRecords = await FeeRecord.find({ provider: userId }).lean();

    // Create wallet data structure
    const walletData = {
      balance: wallet ? wallet.balance : 0,
      availableBalance: wallet ? wallet.availableBalance : 0,
      heldBalance: wallet ? wallet.heldBalance : 0,
      currency: wallet ? wallet.currency : 'PHP',
      isActive: wallet ? wallet.isActive : false,
      isVerified: wallet ? wallet.isVerified : false
    };

    // Transform fee records
    const feesData = feeRecords.map(fee => ({
      _id: fee._id,
      amount: fee.amount,
      dueDate: fee.dueDate,
      isPaid: fee.status === 'paid',
      status: fee.status,
      paymentMethod: fee.paymentMethod,
      createdAt: fee.createdAt
    }));

    return {
      ...user,
      wallet: walletData,
      fees: feesData
    };
  } catch (error) {
    console.error('Error fetching user with data:', error);
    return null;
  }
};

const restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restricted } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isRestricted: restricted,
        accountStatus: restricted ? 'restricted' : 'active',
        ...(restricted ? {
          restrictionDetails: {
            type: 'restricted',
            reason: 'Account restricted by admin',
            restrictedBy: req.session.adminId,
            restrictedAt: new Date(),
            appealAllowed: true
          }
        } : {
          $unset: { restrictionDetails: 1 }
        })
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await getUserWithData(userId);
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: restricted ? 'restricted' : 'unrestricted'
    });
    
    res.json(userWithData);
  } catch (error) {
    console.error('Error updating user restriction:', error);
    res.status(500).json({ error: 'Failed to update user restriction' });
  }
};

const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Ban reason is required' });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        accountStatus: 'banned',
        isRestricted: true,
        restrictionDetails: {
          type: 'banned',
          reason: reason.trim(),
          restrictedBy: req.session.adminId,
          restrictedAt: new Date(),
          appealAllowed: true
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await getUserWithData(userId);
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'banned'
    });
    
    res.json(userWithData);
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Suspension reason is required' });
    }
    
    if (!duration || duration <= 0) {
      return res.status(400).json({ error: 'Valid suspension duration is required' });
    }
    
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + duration);
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        accountStatus: 'suspended',
        isRestricted: true,
        restrictionDetails: {
          type: 'suspended',
          reason: reason.trim(),
          restrictedBy: req.session.adminId,
          restrictedAt: new Date(),
          suspendedUntil,
          appealAllowed: true
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await getUserWithData(userId);
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'suspended'
    });
    
    res.json(userWithData);
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
};

const unrestrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        accountStatus: 'active',
        isRestricted: false,
        $unset: { restrictionDetails: 1 }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await getUserWithData(userId);
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'unrestricted'
    });
    
    res.json(userWithData);
  } catch (error) {
    console.error('Error unrestricting user:', error);
    res.status(500).json({ error: 'Failed to unrestrict user' });
  }
};

const verifyUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verified } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { isVerified: verified },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await getUserWithData(userId);
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: verified ? 'verified' : 'unverified'
    });
    
    res.json(userWithData);
  } catch (error) {
    console.error('Error updating user verification:', error);
    res.status(500).json({ error: 'Failed to update user verification' });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userWithData = await getUserWithData(userId);
    
    if (!userWithData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(userWithData);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

// Utility function to check and auto-unsuspend users
const checkSuspendedUsers = async () => {
  try {
    const now = new Date();
    const expiredSuspensions = await User.updateMany(
      {
        accountStatus: 'suspended',
        'restrictionDetails.suspendedUntil': { $lte: now }
      },
      {
        accountStatus: 'active',
        isRestricted: false,
        $unset: { restrictionDetails: 1 }
      }
    );
    
    if (expiredSuspensions.modifiedCount > 0) {
      console.log(`Auto-unsuspended ${expiredSuspensions.modifiedCount} users`);
    }
  } catch (error) {
    console.error('Error checking suspended users:', error);
  }
};

// Run suspension check every hour
setInterval(checkSuspendedUsers, 60 * 60 * 1000);

module.exports = { 
  getUsers, 
  restrictUser, 
  banUser, 
  suspendUser, 
  unrestrictUser, 
  verifyUser, 
  getUserDetails,
  checkSuspendedUsers 
};