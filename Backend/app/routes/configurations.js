const express = require('express');
const {
  getJobCategories,
  createJobCategory,
  updateJobCategory,
  deleteJobCategory,
  createProfession,
  updateProfession,
  deleteProfession,
} = require('../controllers/configurationsController');

const router = express.Router();

// Middleware to check if user is authenticated admin
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }
  
  const allowedRoles = ['admin', 'superadmin'];
  if (!allowedRoles.includes(req.session.role)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  }
  
  next();
};

// PUBLIC ENDPOINT - Get job categories (no authentication required)
// This allows mobile app users to see categories and professions
router.get('/job-categories', getJobCategories);

// ADMIN ONLY ENDPOINTS - Require authentication and admin role
router.post('/job-categories', requireAdmin, createJobCategory);
router.patch('/job-categories/:categoryId', requireAdmin, updateJobCategory);
router.delete('/job-categories/:categoryId', requireAdmin, deleteJobCategory);

// Professions
router.post('/professions', requireAdmin, createProfession);
router.patch('/professions/:professionId', requireAdmin, updateProfession);
router.delete('/professions/:professionId', requireAdmin, deleteProfession);

module.exports = router;
