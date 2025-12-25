const userService = require('../services/userService');
const { logActivity } = require('../utils/activityLogger');

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {
      search: req.query.search,
      status: req.query.status,
      userType: req.query.userType,
      restricted: req.query.restricted
    };
    
    const query = userService.buildUserQuery(filters);
    const pagination = { skip, limit };
    
    const { users, total } = await userService.getUsers(query, pagination);
    const pages = Math.ceil(total / limit);
    
    res.json({
      users,
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

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

const restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restricted } = req.body;
    
    let user;
    if (restricted) {
      user = await userService.restrictUser(userId, req.session.adminId);
    } else {
      user = await userService.unrestrictUser(userId);
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        restricted ? 'user_restricted' : 'user_unrestricted',
        restricted ? `Restricted user ${user.name}` : `Removed restrictions from ${user.name}`,
        {
          targetType: 'user',
          targetId: userId,
          targetModel: 'User',
          ipAddress: req.ip
        }
      );
    }
    
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
    
    const user = await userService.banUser(userId, reason, req.session.adminId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'user_banned',
        `Banned user ${user.name}`,
        {
          targetType: 'user',
          targetId: userId,
          targetModel: 'User',
          metadata: { reason },
          ipAddress: req.ip
        }
      );
    }
    
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
    
    const user = await userService.suspendUser(userId, reason, duration, req.session.adminId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'user_suspended',
        `Suspended user ${user.name} for ${duration} days`,
        {
          targetType: 'user',
          targetId: userId,
          targetModel: 'User',
          metadata: { reason, duration, suspendedUntil: user.restrictionDetails.suspendedUntil },
          ipAddress: req.ip
        }
      );
    }
    
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
    
    const user = await userService.unrestrictUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'user_unrestricted',
        `Removed restrictions from ${user.name}`,
        {
          targetType: 'user',
          targetId: userId,
          targetModel: 'User',
          ipAddress: req.ip
        }
      );
    }
    
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
    
    const user = await userService.verifyUser(userId, verified);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
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

const checkSuspendedUsers = async () => {
  try {
    const count = await userService.checkSuspendedUsers();
    if (count > 0) {
      console.log(`Auto-unsuspended ${count} users`);
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
