const db = require('../config/db');

class DashboardModel {
    // --- SIMULATION MODE QUERIES ---

    static async getSimulationSummary(simId) {
        // dashboardController line 20
        const [rows] = await db.execute(`
            SELECT SUM(tahmini_yeni_ciro) as ciro, SUM(tahmini_satis_adeti) as adet 
            FROM simulasyon_sonuclari WHERE simulasyon_id = ?`, [simId]);
        return rows[0];
    }

    static async getMagazaCount() {
        // dashboardController line 26 & 67
        const [rows] = await db.execute('SELECT COUNT(*) as sayi FROM magazalar');
        return rows[0].sayi;
    }

    static async getTotalMarketPotential() {
        // dashboardController line 31 & 73
        const [rows] = await db.execute('SELECT SUM(toplam_pazar_potansiyeli) as total FROM magazalar');
        return parseFloat(rows[0].total) || 1;
    }

    static async getSimulationCityPerformance(simId) {
        // dashboardController line 42
        const [rows] = await db.execute(`
            SELECT s.sehir_adi, SUM(ss.tahmini_yeni_ciro) as deger 
            FROM simulasyon_sonuclari ss JOIN sehirler s ON ss.sehir_id = s.id 
            WHERE ss.simulasyon_id = ? GROUP BY s.sehir_adi ORDER BY deger DESC LIMIT 20`, [simId]);
        return rows;
    }

    static async getSimulationMonthlyData(simId) {
        // dashboardController line 52
        const [rows] = await db.execute(`SELECT ay_sirasi, aylik_ciro FROM simulasyon_aylik_detay WHERE simulasyon_id = ? ORDER BY ay_sirasi ASC`, [simId]);
        return rows;
    }

    static async getSimulationCategoryData(simId) {
        // dashboardController line 56
        const [rows] = await db.execute(`SELECT k.kategori_adi, SUM(ss.tahmini_yeni_ciro) as deger FROM simulasyon_sonuclari ss JOIN kategoriler k ON ss.kategori_id = k.id WHERE ss.simulasyon_id = ? GROUP BY k.kategori_adi ORDER BY deger DESC`, [simId]);
        return rows;
    }

    static async getSimulationProfitData(simId) {
        // dashboardController line 60
        const [rows] = await db.execute(`SELECT k.kategori_adi, SUM(ss.tahmini_yeni_kar) as deger FROM simulasyon_sonuclari ss JOIN kategoriler k ON ss.kategori_id = k.id WHERE ss.simulasyon_id = ? GROUP BY k.kategori_adi ORDER BY deger DESC`, [simId]);
        return rows;
    }

    // --- REAL DATA MODE QUERIES ---

    static async getRealDataSummary() {
        // dashboardController line 66
        const [rows] = await db.execute('SELECT SUM(toplam_ciro) as ciro, COUNT(*) as islem FROM satis_gecmisi');
        return rows[0];
    }

    static async getRealTrendData() {
        // dashboardController line 78
        const [rows] = await db.execute("SELECT DATE_FORMAT(satis_tarihi, '%Y-%m') as ay, SUM(toplam_ciro) as toplam FROM satis_gecmisi GROUP BY ay ORDER BY ay ASC");
        return rows;
    }

    static async getRealCategoryData() {
        // dashboardController line 81
        const [rows] = await db.execute("SELECT k.kategori_adi, SUM(sg.toplam_ciro) as deger FROM satis_gecmisi sg JOIN urunler u ON sg.urun_id = u.id JOIN kategoriler k ON u.kategori_id = k.id GROUP BY k.kategori_adi");
        return rows;
    }

    static async getRealProfitData() {
        // dashboardController line 84
        const [rows] = await db.execute("SELECT k.kategori_adi, SUM(sg.toplam_ciro - sg.toplam_maliyet) as deger FROM satis_gecmisi sg JOIN urunler u ON sg.urun_id = u.id JOIN kategoriler k ON u.kategori_id = k.id GROUP BY k.kategori_adi");
        return rows;
    }

    static async getRealCityPerformance() {
        // dashboardController line 87
        const [rows] = await db.execute("SELECT s.sehir_adi, SUM(sg.toplam_ciro) as deger FROM satis_gecmisi sg JOIN magazalar m ON sg.magaza_id = m.id JOIN sehirler s ON m.sehir_id = s.id GROUP BY s.sehir_adi ORDER BY deger DESC LIMIT 20");
        return rows;
    }

    // --- COMMON ---

    static async getAllSimulations() {
        // dashboardController line 92
        try {
            const [rows] = await db.execute('SELECT * FROM simulasyonlar ORDER BY id DESC');
            return rows;
        } catch (e) {
            return [];
        }
    }
}

module.exports = DashboardModel;
