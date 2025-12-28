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

const adminAuth = (req, res, next) => {
  if (req.session && req.session.isAuthenticated && (req.session.role === 'admin' || req.session.role === 'superadmin')) {
    // Attach admin user data to request object
    req.user = {
      id: req.session.userId || req.session.adminId || 'admin',
      username: req.session.username,
      role: req.session.role,
      email: req.session.email
    };
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    error: 'Admin access required' 
  });
};

module.exports = { authMiddleware, adminAuth };