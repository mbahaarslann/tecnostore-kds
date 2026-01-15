// routes/geoRoutes.js
const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geoController');

// Coğrafi Analiz Sayfasını Getir
router.get('/', geoController.getGeoPage);

// Harita için Verileri JSON olarak döndür (API)
router.get('/data', geoController.getMapData);

module.exports = router;