const express = require('express');
const { login, logout, checkAuth } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/check', checkAuth);

module.exports = router;