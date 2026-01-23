const User = require('../models/User');

const authMiddleware = (req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    // Attach user data to request object
    req.user = {
      id: req.session.userId || req.session.adminId || 'admin',
      username: req.session.username,
      role: req.session.role,
      email: req.session.email
    };
    return next();
  }
  
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required' 
  });
};

const adminAuth = async (req, res, next) => {
  if (req.session && req.session.isAuthenticated && (req.session.role === 'admin' || req.session.role === 'superadmin')) {
    try {
      // Fetch admin user from database to get full details
      const adminUser = await User.findById(req.session.userId || req.session.adminId).select('name email userType');
      
      // Attach admin user data to request object
      req.user = {
        id: req.session.userId || req.session.adminId || 'admin',
        username: req.session.username,
        role: req.session.role,
        email: req.session.email
      };
      
      // Attach full admin details for activity logging
      req.admin = {
        id: adminUser?._id.toString() || req.session.userId || req.session.adminId,
        name: adminUser?.name || 'Admin',
        email: adminUser?.email || req.session.email,
        userType: adminUser?.userType || req.session.role
      };
      
      return next();
    } catch (error) {
      console.error('Error fetching admin user:', error);
      // Fallback to session data if DB fetch fails
      req.user = {
        id: req.session.userId || req.session.adminId || 'admin',
        username: req.session.username,
        role: req.session.role,
        email: req.session.email
      };
      
      req.admin = {
        id: req.session.userId || req.session.adminId,
        name: 'Admin',
        email: req.session.email
      };
      
      return next();
    }
  }
  
  return res.status(403).json({ 
    success: false, 
    error: 'Admin access required' 
  });
};

module.exports = { authMiddleware, adminAuth };