const express = require('express');
const multer = require('multer');
const {
  getJobCategories,
  createJobCategory,
  updateJobCategory,
  deleteJobCategory,
  createProfession,
  updateProfession,
  deleteProfession,
  uploadCategoryIcon,
  uploadProfessionIcon,
  updateQuickAccessProfessions,
} = require('../controllers/configurationsController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

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

// Category Icon Upload
router.post('/upload-category-icon', requireAdmin, upload.single('icon'), uploadCategoryIcon);

// Profession Icon Upload
router.post('/upload-profession-icon', requireAdmin, upload.single('icon'), uploadProfessionIcon);

// Quick Access Professions Management
router.post('/quick-access-professions', requireAdmin, updateQuickAccessProfessions);

// Debug endpoint to check quick access professions
router.get('/quick-access-professions/debug', async (req, res) => {
  try {
    const categories = await require('../models/JobCategory').find();
    const quickAccessProfessions = [];
    
    categories.forEach(category => {
      category.professions.forEach(profession => {
        if (profession.isQuickAccess) {
          quickAccessProfessions.push({
            _id: profession._id,
            name: profession.name,
            categoryName: category.name,
            quickAccessOrder: profession.quickAccessOrder,
            isQuickAccess: profession.isQuickAccess
          });
        }
      });
    });
    
    quickAccessProfessions.sort((a, b) => a.quickAccessOrder - b.quickAccessOrder);
    
    res.json({
      success: true,
      count: quickAccessProfessions.length,
      professions: quickAccessProfessions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
