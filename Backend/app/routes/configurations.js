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
  transferProfession,
  uploadCategoryIcon,
  uploadProfessionIcon,
  updateQuickAccessProfessions,
  getJobPostingSettings,
  updateJobPostingSettings,
} = require('../controllers/configurationsController');
const {
  getAdvertisements,
  getPublicAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  reorderAdvertisements,
  deleteAdvertisement,
  uploadAdvertisementImage,
} = require('../controllers/advertisementsController');

const {
  getLegalDocuments,
  updateLegalDocument,
  resetLegalDocument,
} = require('../controllers/legalController');

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
router.patch('/professions/:professionId/transfer', requireAdmin, transferProfession);
router.patch('/professions/:professionId', requireAdmin, updateProfession);
router.delete('/professions/:professionId', requireAdmin, deleteProfession);

// Category Icon Upload
router.post('/upload-category-icon', requireAdmin, upload.single('icon'), uploadCategoryIcon);

// Profession Icon Upload
router.post('/upload-profession-icon', requireAdmin, upload.single('icon'), uploadProfessionIcon);

// Quick Access Professions Management
router.post('/quick-access-professions', requireAdmin, updateQuickAccessProfessions);

// Job Posting Settings
router.get('/job-posting', requireAdmin, getJobPostingSettings);
router.patch('/job-posting', requireAdmin, updateJobPostingSettings);

// Legal Documents — the five executed agreements shown in the Kayod app.
// The client app reads its copy from the Kayod server's public
// /configurations/legal-documents endpoint; these are the editing routes.
router.get('/legal-documents', requireAdmin, getLegalDocuments);
router.patch('/legal-documents/:documentId', requireAdmin, updateLegalDocument);
router.post('/legal-documents/:documentId/reset', requireAdmin, resetLegalDocument);

// Advertisements
router.get('/advertisements/public', getPublicAdvertisements); // public (client app)
router.get('/advertisements', requireAdmin, getAdvertisements);
router.post('/advertisements', requireAdmin, createAdvertisement);
router.post('/advertisements/upload-image', requireAdmin, upload.single('image'), uploadAdvertisementImage);
// Must precede '/advertisements/:id' — otherwise :id captures 'reorder'.
router.patch('/advertisements/reorder', requireAdmin, reorderAdvertisements);
router.patch('/advertisements/:id', requireAdmin, updateAdvertisement);
router.delete('/advertisements/:id', requireAdmin, deleteAdvertisement);

module.exports = router;
