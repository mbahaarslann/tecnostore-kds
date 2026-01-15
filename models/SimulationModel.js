const db = require('../config/db');

class SimulationModel {
    static async getCityCapacities() {
        // simulationController line 54
        const [rows] = await db.execute('SELECT sehir_id, SUM(toplam_pazar_potansiyeli) as kapasite FROM magazalar GROUP BY sehir_id');
        return rows;
    }

    static async getSimulationSourceData(duration) {
        // simulationController line 60-73
        // Note: Using parameter interpolation for duration is tricky in prepared statements for INTERVAL if not careful, 
        // but here the original code used template literal `${sure}`. 
        // Ideally we should validate 'duration' is a number to prevent injection.
        // I will assume duration is safe/validated by controller or is a number.
        const safeDuration = parseInt(duration) || 6;

        const fullDataSql = `
            SELECT 
                u.marka_id, u.kategori_id, m.sehir_id,
                ma.marka_adi, ma.mensei,  
                COUNT(*) as adet, 
                AVG(sg.birim_fiyat) as ort_fiyat, 
                AVG(sg.toplam_maliyet) as ort_maliyet 
            FROM satis_gecmisi sg
            JOIN urunler u ON sg.urun_id = u.id
            JOIN markalar ma ON u.marka_id = ma.id
            JOIN magazalar m ON sg.magaza_id = m.id
            WHERE satis_tarihi >= DATE_SUB(NOW(), INTERVAL ${safeDuration} MONTH)
            GROUP BY u.marka_id, u.kategori_id, m.sehir_id, ma.marka_adi, ma.mensei
        `;
        const [rows] = await db.execute(fullDataSql);
        return rows;
    }

    static async createSimulation(data) {
        // simulationController line 230-235
        const { sim_name, scenarioType, sure, savedUsdValue, inflationPercent, priceChangePercent, logCity, logBrand, logCat } = data;

        const [result] = await db.execute(
            `INSERT INTO simulasyonlar 
            (simulasyon_adi, senaryo_tipi, sure, girilen_dolar_kuru, enflasyon_orani, zam_orani, kapsam_sehir, kapsam_marka, kapsam_kategori, olusturma_tarihi) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [sim_name, scenarioType, sure, savedUsdValue, inflationPercent, priceChangePercent, logCity, logBrand, logCat]
        );
        return result.insertId;
    }

    static async addMonthlyDetail(data) {
        // simulationController line 239-241
        const { simId, month, ciro, kar, adet } = data;
        await db.execute(
            "INSERT INTO simulasyon_aylik_detay (simulasyon_id, ay_sirasi, aylik_ciro, aylik_kar, aylik_islem_adedi) VALUES (?, ?, ?, ?, ?)",
            [simId, month, ciro, kar, adet]
        );
    }

    static async getPastRealData(duration, filters) {
        // simulationController line 250-265
        const safeDuration = parseInt(duration) || 6;
        let pastQuery = `
            SELECT 
                SUM(sg.toplam_ciro) as ciro, 
                SUM(sg.toplam_ciro - sg.toplam_maliyet) as kar 
            FROM satis_gecmisi sg 
            JOIN magazalar m ON sg.magaza_id = m.id 
            JOIN urunler u ON sg.urun_id = u.id  
            WHERE sg.satis_tarihi >= DATE_SUB(NOW(), INTERVAL ${safeDuration} MONTH)
        `;
        let pastParams = [];

        if (filters.targetCityId !== null) { pastQuery += " AND m.sehir_id = ?"; pastParams.push(filters.targetCityId); }
        if (filters.targetCategoryId !== null) { pastQuery += " AND u.kategori_id = ?"; pastParams.push(filters.targetCategoryId); }
        if (filters.targetBrandId !== null) { pastQuery += " AND u.marka_id = ?"; pastParams.push(filters.targetBrandId); }

        const [rows] = await db.execute(pastQuery, pastParams);
        return rows[0];
    }

    static async addSimulationResult(data) {
        // simulationController line 298-303
        const { simId, kategori_id, sehir_id, priceChangePercent, ciro, kar, itemShare, adet } = data;
        await db.execute(
            `INSERT INTO simulasyon_sonuclari 
            (simulasyon_id, kategori_id, sehir_id, zam_orani_yuzde, tahmini_yeni_ciro, tahmini_yeni_kar, tahmini_pazar_payi, tahmini_satis_adeti) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [simId, kategori_id, sehir_id, priceChangePercent, ciro, kar, itemShare, adet]
        );
    }

    static async getAverageSuccessScore(filters) {
        // simulationController line 307-311
        let scoreSql = `SELECT AVG(basari_puani) as puan FROM magazalar m`;
        let scoreParams = [];
        if (filters.targetCityId !== null) { scoreSql += " WHERE m.sehir_id = ?"; scoreParams.push(filters.targetCityId); }

        const [rows] = await db.execute(scoreSql, scoreParams);
        return parseFloat(rows[0].puan) || 80;
    }

    static async updateScenarioType(simId, type) {
        // simulationController line 373
        await db.execute('UPDATE simulasyonlar SET senaryo_tipi = ? WHERE id = ?', [type, simId]);
    }

    static async deleteSimulation(simId) {
        // simulationController line 381-383
        await db.execute('DELETE FROM simulasyon_aylik_detay WHERE simulasyon_id = ?', [simId]);
        await db.execute('DELETE FROM simulasyon_sonuclari WHERE simulasyon_id = ?', [simId]);
        await db.execute('DELETE FROM simulasyonlar WHERE id = ?', [simId]);
    }

    static async getAllSimulations() {
        // simulationController line 390
        const [rows] = await db.execute('SELECT * FROM simulasyonlar ORDER BY id DESC');
        return rows;
    }
    static async getSimulationById(simId) {
        const [rows] = await db.execute('SELECT * FROM simulasyonlar WHERE id = ?', [simId]);
        return rows[0];
    }

    static async updateSimulation(simId, simName, scenarioType) {
        await db.execute(
            'UPDATE simulasyonlar SET simulasyon_adi = ?, senaryo_tipi = ? WHERE id = ?',
            [simName, scenarioType, simId]
        );
    }
}

module.exports = SimulationModel;
