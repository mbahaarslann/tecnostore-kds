const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');

// --- ADMIN ROUTES ---

// 3-Year Massive Data Regeneration
router.get('/regenerate-data', AdminController.regenerateData);

// Calibrate Market Share
router.get('/calibrate-market-share', AdminController.calibrateMarketShare);

module.exports = router;
