const db = require('../config/db');

class GeoModel {
    /**
     * Get Map Data for Simulation Mode
     * @param {number} simId 
     */
    static async getGeoDataSimulation(simId) {
        // geoController line 14-26
        const [rows] = await db.execute(`
            SELECT 
                s.sehir_adi,
                s.id as sehir_id,
                COALESCE(SUM(ss.tahmini_yeni_ciro), 0) as ciro,
                COALESCE(SUM(ss.tahmini_yeni_kar), 0) as kar,
                (SELECT COALESCE(SUM(toplam_pazar_potansiyeli), 1) 
                 FROM magazalar m WHERE m.sehir_id = s.id) as kapasite,
                (SELECT AVG(basari_puani) FROM magazalar m WHERE m.sehir_id = s.id) as db_puan
            FROM sehirler s
            LEFT JOIN simulasyon_sonuclari ss ON ss.sehir_id = s.id AND ss.simulasyon_id = ?
            GROUP BY s.id, s.sehir_adi
        `, [simId]);
        return rows;
    }

    /**
     * Get Map Data for Real Data Mode (Last 12 Months)
     */
    static async getGeoDataReal() {
        // geoController line 32-41
        const [rows] = await db.execute(`
            SELECT 
                s.sehir_adi,
                s.id as sehir_id,
                (SELECT COALESCE(SUM(toplam_ciro), 0) FROM satis_gecmisi sg JOIN magazalar m ON sg.magaza_id = m.id WHERE m.sehir_id = s.id AND sg.satis_tarihi >= DATE_SUB(NOW(), INTERVAL 12 MONTH)) as ciro,
                (SELECT COALESCE(SUM(toplam_ciro - toplam_maliyet), 0) FROM satis_gecmisi sg JOIN magazalar m ON sg.magaza_id = m.id WHERE m.sehir_id = s.id AND sg.satis_tarihi >= DATE_SUB(NOW(), INTERVAL 12 MONTH)) as kar,
                (SELECT COALESCE(SUM(toplam_pazar_potansiyeli), 1) FROM magazalar m WHERE m.sehir_id = s.id) as kapasite,
                (SELECT AVG(basari_puani) FROM magazalar m WHERE m.sehir_id = s.id) as db_puan
            FROM sehirler s
        `);
        return rows;
    }
}

module.exports = GeoModel;
