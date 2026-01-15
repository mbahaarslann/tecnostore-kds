const GeoModel = require('../models/GeoModel');

exports.getGeoPage = (req, res) => {
    res.render('cografi_analiz');
};

exports.getMapData = async (req, res) => {
    try {
        const simId = req.query.simId || null;
        let rows = [];

        // --- A) SİMÜLASYON MODU ---
        if (simId) {
            rows = await GeoModel.getGeoDataSimulation(simId);
        }

        // --- B) GERÇEK VERİ MODU (SON 12 AY) ---
        else {
            rows = await GeoModel.getGeoDataReal();
        }

        // 1. Şehir Verilerini İşle
        const cities = rows.map(row => {
            const ciro = Number(row.ciro) || 0;
            const kar = Number(row.kar) || 0;
            const kapasite = Number(row.kapasite) || 1;
            const dbPuan = Number(row.db_puan) || 70;

            let pazarPayi = (ciro / kapasite) * 100;
            let memnuniyet = dbPuan / 20; // 0-100 -> 0-5 Dönüşümü

            return {
                sehir: row.sehir_adi,
                ciro: ciro,
                kar: kar,
                pazarPayi: parseFloat(pazarPayi.toFixed(2)),
                memnuniyet: parseFloat(memnuniyet.toFixed(2)) // Sabit 2 hane
            };
        });

        // 2. Özet Tablo Verilerini Hazırla (Backend'de Sıralama)
        // Bu sayede frontend'de "veri gelmedi" sorunu olmaz.
        const sortDesc = (key) => [...cities].sort((a, b) => b[key] - a[key]).slice(0, 5);
        const sortAsc = (key) => [...cities].sort((a, b) => a[key] - b[key]).slice(0, 5);

        const summary = {
            ciro: { top: sortDesc('ciro'), bottom: sortAsc('ciro') },
            kar: { top: sortDesc('kar'), bottom: sortAsc('kar') },
            pazarPayi: { top: sortDesc('pazarPayi'), bottom: sortAsc('pazarPayi') },
            memnuniyet: { top: sortDesc('memnuniyet'), bottom: sortAsc('memnuniyet') }
        };

        // 3. Hepsini Paketle Gönder
        res.json({
            cities: cities,
            summary: summary
        });

    } catch (error) {
        console.error("GEO API HATASI:", error);
        res.status(500).json({ error: error.message });
    }
};