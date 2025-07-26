const bcrypt = require('bcryptjs');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Simple admin authentication
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (username === adminUsername && password === adminPassword) {
      req.session.isAuthenticated = true;
      req.session.role = 'admin';
      req.session.username = username;

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          username: username,
          role: 'admin'
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
    res.json({
      success: true,
      isAuthenticated: true,
      user: {
        username: req.session.username,
        role: req.session.role
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