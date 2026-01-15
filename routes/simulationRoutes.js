// routes/simulationRoutes.js
const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');

// 1. Simülasyon Formu (GET)
router.get('/yeni', simulationController.getNewSimulationPage);

// 2. Simülasyonu HESAPLA ve KAYDET (POST) - YENİ EKLENEN KISIM
router.post('/hesapla', simulationController.runSimulation);

// 3. Geçmiş Simülasyonlar (GET)
router.get('/gecmis', simulationController.getPastSimulations);

// 4. Senaryo tipini güncelle (POST)
router.post('/guncelle', simulationController.updateScenarioType);

// 5. Simülasyonu sil (DELETE)
router.delete('/sil/:simId', simulationController.deleteSimulation);

// 6. Simülasyon Düzenleme Sayfası (GET)
router.get('/duzenle/:simId', simulationController.getEditPage);

// 7. Simülasyon Güncelle (PUT)
router.put('/:simId', simulationController.updateSimulation);

module.exports = router;