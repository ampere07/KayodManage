const userService = require('../services/userService');
const { setUserVerified } = require('../services/userVerification');
const { logActivity } = require('../utils/activityLogger');
const { getIO } = require('../realtime/ioRegistry');
const { logger } = require('../utils/logger');

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {
      search: req.query.search,
      status: req.query.status,
      userType: req.query.userType,
      restricted: req.query.restricted,
      isVerified: req.query.isVerified,
      accountStatus: req.query.accountStatus,
      profession: req.query.profession
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
    logger.error('Error fetching users', { err: error });
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
    logger.error('Error fetching user details', { err: error });
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

const restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restricted, duration, reason } = req.body;

    if (restricted !== true) {
      return res.status(400).json({ error: 'restricted must be true; lift a restriction through PATCH /api/users/:userId/unrestrict' });
    }
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Restriction reason is required' });
    }
    if (duration !== undefined && !(typeof duration === 'number' && duration > 0)) {
      return res.status(400).json({ error: 'Restriction duration must be a positive number of days' });
    }

    const user = await userService.restrictUser(userId, req.session.adminId, duration, reason);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'user_restricted',
        `Restricted user ${user.name}`,
        {
          targetType: 'user',
          targetId: userId,
          targetModel: 'User',
          metadata: { reason },
          ipAddress: req.ip
        }
      );
    }
    
    const io = getIO();
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'restricted'
    });
    
    res.json(userWithData);
  } catch (error) {
    logger.error('Error updating user restriction', { err: error });
    res.status(500).json({ error: 'Failed to update user restriction' });
  }
};

const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Ban reason is required' });
    }
    
    const user = await userService.banUser(userId, reason, req.session.adminId, duration);
    
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
    
    const io = getIO();
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'banned'
    });
    
    res.json(userWithData);
  } catch (error) {
    logger.error('Error banning user', { err: error });
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
    
    const io = getIO();
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'suspended'
    });
    
    res.json(userWithData);
  } catch (error) {
    logger.error('Error suspending user', { err: error });
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
    
    const io = getIO();
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'unrestricted'
    });
    
    res.json(userWithData);
  } catch (error) {
    logger.error('Error unrestricting user', { err: error });
    res.status(500).json({ error: 'Failed to unrestrict user' });
  }
};

const verifyUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verified } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'verified must be true or false' });
    }

    const user = await setUserVerified(userId, verified, req.session.adminId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    const io = getIO();
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: verified ? 'verified' : 'unverified'
    });
    
    res.json(userWithData);
  } catch (error) {
    logger.error('Error updating user verification', { err: error });
    res.status(500).json({ error: 'Failed to update user verification' });
  }
};

const softDeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Delete reason is required' });
    }
    
    const user = await userService.softDeleteUser(userId, reason, req.session.adminId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userWithData = await userService.getUserById(userId);
    
    if (req.user && req.user.id) {
      await logActivity(
        req.user.id,
        'user_deleted',
        `Soft deleted user ${user.name}`,
        {
          targetType: 'user',
          targetId: userId,
          targetModel: 'User',
          metadata: { reason },
          ipAddress: req.ip
        }
      );
    }
    
    const io = getIO();
    io.to('admin').emit('user:updated', {
      user: userWithData,
      updateType: 'deleted'
    });
    
    res.json(userWithData);
  } catch (error) {
    logger.error('Error soft deleting user', { err: error });
    res.status(500).json({ error: 'Failed to soft delete user' });
  }
};

const checkSuspendedUsers = async () => {
  try {
    const count = await userService.checkSuspendedUsers();
    if (count > 0) {
      logger.info('Suspended users auto-unsuspended', { count });
    }
  } catch (error) {
    logger.error('Error checking suspended users', { err: error });
  }
};

module.exports = { 
  getUsers, 
  restrictUser, 
  banUser, 
  suspendUser, 
  unrestrictUser, 
  verifyUser, 
  getUserDetails,
  softDeleteUser,
  checkSuspendedUsers 
};
