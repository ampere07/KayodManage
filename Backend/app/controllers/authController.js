const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { getLocationFromIP } = require('../utils/geolocation');
const { clientIp } = require('../utils/clientIp');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');

const login = async (req, res) => {
  const { username, password } = req.body;

  console.log('[Auth] Login attempt for:', username);

  // +password: the field is `select: false` on the schema so it never rides
  // along on an unprojected query. Login is the one place that needs it.
  const admin = await User.findOne({
    email: username,
    userType: { $in: ['admin', 'superadmin'] }
  }).select('+password');
  
  console.log('[Auth] Admin found:', admin ? 'YES' : 'NO', admin ? `(type: ${admin.userType})` : '');
  
  if (!admin) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  if (!admin.password) {
    console.log('[Auth] No password set for admin user');
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  console.log('[Auth] Comparing password...');
  const isValidPassword = await bcrypt.compare(password, admin.password);
  console.log('[Auth] Password valid:', isValidPassword);
  
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
  
  // The address our proxy saw, not a header the browser could set (utils/clientIp).
  const realIp = clientIp(req) || 'Unknown';

  // Get location from IP
  const location = getLocationFromIP(realIp);

  const now = new Date().toISOString();
  req.session.isAuthenticated = true;
  req.session.role = admin.userType;
  req.session.username = admin.email;
  req.session.adminId = admin._id.toString();
  req.session.userId = admin._id.toString();
  req.session.userAgent = req.get('User-Agent') || 'Unknown';
  req.session.ipAddress = realIp;
  req.session.location = location;
  req.session.sessionId = req.sessionID;
  // Superadmins see when and where each session was last used (Settings → Management).
  req.session.signedInAt = now;
  req.session.lastSeenAt = now;
  req.session.lastIp = realIp;

  const signInLog = await logActivity(admin._id, 'admin_login', location && location !== 'Unknown' ? `Signed in from ${location}` : 'Signed in', {
    targetType: 'admin',
    targetId: admin._id,
    targetModel: 'User',
    ipAddress: realIp,
    userAgent: req.session.userAgent,
    metadata: { location, targetName: admin.name }
  });
  // Ties this session to its sign-in entry, so the session list doesn't show it twice.
  if (signInLog?._id) req.session.signInLogId = String(signInLog._id);

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
      const user = await User.findById(req.session.userId).select('permissions userType name email accountStatus');

      // The account as it is now decides access, not the role cached at sign-in
      // (see adminAuth). A deactivated or demoted admin is signed out here too.
      if (user && (user.accountStatus !== 'active' || !['admin', 'superadmin'].includes(user.userType))) {
        req.session.destroy(() => {});
        return res.json({ success: false, isAuthenticated: false });
      }
      if (user) req.session.role = user.userType;
      
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

module.exports = {
  login: asyncHandler(login, 'Internal server error'),
  logout,
  checkAuth,
};
