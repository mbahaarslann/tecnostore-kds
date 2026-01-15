const db = require('../config/db');

class AdminModel {
    /**
     * Tabloyu temizler (Truncate)
     * @param {string} tableName 
     */
    static async truncateTable(tableName) {
        await db.execute(`TRUNCATE TABLE ${tableName}`);
    }

    /**
     * Müşterileri getirir (Limitli)
     * @param {number} limit 
     */
    static async getCustomers(limit = 20000) {
        const [rows] = await db.execute(`SELECT id, sehir_id FROM musteriler LIMIT ${limit}`);
        return rows;
    }

    /**
     * Mağazaları ve şehir bilgilerini getirir.
     */
    static async getStores() {
        const [rows] = await db.execute('SELECT id, sehir_id FROM magazalar');
        return rows;
    }

    /**
     * Ürünleri getirir.
     */
    static async getProducts() {
        const [rows] = await db.execute('SELECT id, satis_fiyati, cikis_yili FROM urunler ORDER BY id ASC');
        return rows;
    }

    /**
     * Toplu satış verisi ekler.
     * @param {Array} values 
     */
    static async batchInsertSales(values) {
        if (values.length === 0) return;

        // Dinamik placeholder oluştur (?,?,...)
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');

        // Düzleştirilmiş array (flat array)
        const flatValues = values.flat();

        await db.execute(`
            INSERT INTO satis_gecmisi 
            (magaza_id, musteri_id, urun_id, satis_tarihi, adet, birim_fiyat, toplam_ciro, toplam_maliyet) 
            VALUES ${placeholders}
        `, flatValues);
    }

    /**
     * Mağaza pazar potansiyelini ve başarı puanını günceller.
     */
    static async updateStorePotential(storeId, potential, successScore) {
        await db.execute(`
            UPDATE magazalar 
            SET toplam_pazar_potansiyeli = ?, basari_puani = ? 
            WHERE id = ?
        `, [potential, successScore, storeId]);
    }

    /**
     * Kalibrasyon için mağaza cirolarını getirir.
     */
    static async getStoreRevenues() {
        const [rows] = await db.execute(`
            SELECT m.id as magaza_id, COALESCE(SUM(sg.toplam_ciro), 0) as toplam_ciro_total
            FROM magazalar m
            LEFT JOIN satis_gecmisi sg ON m.id = sg.magaza_id
            GROUP BY m.id
        `);
        return rows;
    }

    /**
     * Toplam Pazar Potansiyelini getirir.
     */
    static async getTotalMarketPotential() {
        const [rows] = await db.execute('SELECT SUM(toplam_pazar_potansiyeli) as toplam_pazar FROM magazalar');
        return rows[0].toplam_pazar || 0;
    }

    /**
     * Mağaza bazlı pazar payı dağılımını analiz için getirir.
     */
    static async getStoreMarketShares() {
        const [rows] = await db.execute(`
            SELECT 
                m.id,
                COALESCE(SUM(sg.toplam_ciro), 0) as revenue_total,
                m.toplam_pazar_potansiyeli,
                CASE 
                    WHEN m.toplam_pazar_potansiyeli > 0 
                    THEN (COALESCE(SUM(sg.toplam_ciro), 0) / m.toplam_pazar_potansiyeli) * 100
                    ELSE 0
                END as market_share
            FROM magazalar m
            LEFT JOIN satis_gecmisi sg ON m.id = sg.magaza_id
            GROUP BY m.id, m.toplam_pazar_potansiyeli
            HAVING revenue_total > 0
        `);
        return rows;
    }
}

module.exports = AdminModel;
