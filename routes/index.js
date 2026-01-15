const express = require('express');
const router = express.Router();

// Import sub-routes
const dashboardRoutes = require('./dashboardRoutes');
const simulationRoutes = require('./simulationRoutes');
const geoRoutes = require('./geoRoutes');
const adminRoutes = require('./adminRoutes');

// Mount routes
router.use('/', dashboardRoutes);
router.use('/simulasyon', simulationRoutes);
router.use('/cografi-analiz', geoRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
