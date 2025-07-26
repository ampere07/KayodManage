const User = require('../models/User');

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
      query.isRestricted = true;
    } else if (status === 'online') {
      query.isOnline = true;
    }
    
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
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

const restrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restricted } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { isRestricted: restricted },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user,
      updateType: restricted ? 'restricted' : 'unrestricted'
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user restriction:', error);
    res.status(500).json({ error: 'Failed to update user restriction' });
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
    
    // Emit socket event for real-time update
    const { io } = require('../../server');
    io.to('admin').emit('user:updated', {
      user,
      updateType: verified ? 'verified' : 'unverified'
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user verification:', error);
    res.status(500).json({ error: 'Failed to update user verification' });
  }
};

module.exports = { getUsers, restrictUser, verifyUser };