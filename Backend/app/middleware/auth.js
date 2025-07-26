const authMiddleware = (req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required' 
  });
};

const adminAuth = (req, res, next) => {
  if (req.session && req.session.isAuthenticated && req.session.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    error: 'Admin access required' 
  });
};

module.exports = { authMiddleware, adminAuth };