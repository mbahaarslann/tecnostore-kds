// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Ana sayfaya ('/') gelindiğinde controller'daki fonksiyonu çalıştır
router.get('/', dashboardController.getDashboard);

module.exports = router;