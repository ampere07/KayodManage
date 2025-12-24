const express = require('express');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/debug/session', adminAuth, (req, res) => {
  res.json({
    user: req.user,
    session: {
      isAuthenticated: req.session.isAuthenticated,
      userId: req.session.userId,
      adminId: req.session.adminId,
      username: req.session.username,
      role: req.session.role,
      email: req.session.email
    }
  });
});

module.exports = router;
