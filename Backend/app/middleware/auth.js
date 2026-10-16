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

const ADMIN_ROLES = ['admin', 'superadmin'];

const endSession = (req, res) => {
  const message = 'Your admin access has ended. Please sign in again.';
  req.session.destroy(() => {});
  return res.status(401).json({ success: false, error: message, message });
};

const adminAuth = async (req, res, next) => {
  if (req.session && req.session.isAuthenticated && ADMIN_ROLES.includes(req.session.role)) {
    try {
      // Fetch admin user from database to get full details
      const adminUser = await User.findById(req.session.userId || req.session.adminId).select('name email userType accountStatus');

      // Access follows the account as it is now, not as it was at sign-in: a
      // deactivated, demoted or deleted admin loses access on their next request
      // instead of keeping it until the session cookie expires.
      if (!adminUser || adminUser.accountStatus !== 'active' || !ADMIN_ROLES.includes(adminUser.userType)) {
        return endSession(req, res);
      }
      req.session.role = adminUser.userType;

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

/**
 * Superadmin-only routes: the audit log and admin management. Runs adminAuth
 * first, so the role is the account's current one — a demoted superadmin is
 * refused on their next request. If the account lookup failed, adminAuth's
 * fallback carries no userType and this refuses.
 */
const requireSuperAdmin = (req, res, next) =>
  adminAuth(req, res, () => {
    if (req.admin?.userType !== 'superadmin') {
      const message = 'Only superadmins can do this';
      return res.status(403).json({ success: false, error: message, message });
    }
    return next();
  });

module.exports = { authMiddleware, adminAuth, requireSuperAdmin };