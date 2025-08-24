const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Simple admin authentication
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (username === adminUsername && password === adminPassword) {
      // Generate a consistent adminId - use a fixed string for simplicity
      // Since we're not using ObjectIds for admin assignment, we can use any unique string
      const adminId = process.env.ADMIN_ID || `admin_${username}`;
      
      req.session.isAuthenticated = true;
      req.session.role = 'admin';
      req.session.username = username;
      req.session.adminId = adminId;
      req.session.userId = adminId; // Set userId to be compatible with middleware

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          username: username,
          role: 'admin',
          adminId: adminId
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Could not log out'
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
};

const checkAuth = (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    // Ensure userId is set for backward compatibility
    if (!req.session.userId && req.session.adminId) {
      req.session.userId = req.session.adminId;
    }
    
    res.json({
      success: true,
      isAuthenticated: true,
      user: {
        username: req.session.username,
        role: req.session.role,
        adminId: req.session.adminId,
        userId: req.session.userId
      }
    });
  } else {
    res.json({
      success: false,
      isAuthenticated: false
    });
  }
};

module.exports = { login, logout, checkAuth };