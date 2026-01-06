const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { getLocationFromIP } = require('../utils/geolocation');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await User.findOne({ 
      email: username,
      userType: { $in: ['admin', 'superadmin'] }
    });
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (!admin.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (admin.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is disabled'
      });
    }

    admin.lastLogin = new Date();
    await admin.save();
    
    // Get real IP address (handle proxy headers)
    const realIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                   req.headers['x-real-ip'] || 
                   req.ip || 
                   req.connection.remoteAddress || 
                   'Unknown';
    
    // Get location from IP
    const location = getLocationFromIP(realIp);
      
    req.session.isAuthenticated = true;
    req.session.role = admin.userType;
    req.session.username = admin.email;
    req.session.adminId = admin._id.toString();
    req.session.userId = admin._id.toString();
    req.session.userAgent = req.get('User-Agent') || 'Unknown';
    req.session.ipAddress = realIp;
    req.session.location = location;
    req.session.sessionId = req.sessionID;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: admin._id,
        username: admin.email,
        name: admin.name,
        email: admin.email,
        role: admin.userType
      }
    });
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

const checkAuth = async (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    if (!req.session.userId && req.session.adminId) {
      req.session.userId = req.session.adminId;
    }
    
    try {
      const User = require('../models/User');
      const user = await User.findById(req.session.userId).select('permissions userType name email');
      
      const permissions = user?.permissions || {
        dashboard: true,
        users: true,
        jobs: true,
        transactions: true,
        verifications: true,
        support: true,
        activity: true,
        flagged: true,
        settings: user?.userType === 'superadmin'
      };

      res.json({
        success: true,
        isAuthenticated: true,
        user: {
          username: req.session.username,
          name: user?.name,
          email: user?.email,
          role: req.session.role,
          adminId: req.session.adminId,
          userId: req.session.userId,
          permissions: permissions
        }
      });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
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
    }
  } else {
    res.json({
      success: false,
      isAuthenticated: false
    });
  }
};

module.exports = { login, logout, checkAuth };