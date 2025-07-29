const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Simple admin authentication
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (username === adminUsername && password === adminPassword) {
      // Generate a consistent adminId based on username (or use a fixed one for simplicity)
      const adminId = process.env.ADMIN_ID || 'admin-' + Buffer.from(username).toString('base64');
      
      req.session.isAuthenticated = true;
      req.session.role = 'admin';
      req.session.username = username;
      req.session.adminId = adminId;

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
    res.json({
      success: true,
      isAuthenticated: true,
      user: {
        username: req.session.username,
        role: req.session.role,
        adminId: req.session.adminId
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