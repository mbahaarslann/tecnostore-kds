const db = require('../config/db');

class MetaDataModel {
    static async getAllCities() {
        // simulationController line 21
        const [rows] = await db.execute('SELECT id, sehir_adi FROM sehirler ORDER BY sehir_adi ASC');
        return rows;
    }

    static async getAllCategories() {
        // simulationController line 22
        const [rows] = await db.execute('SELECT id, kategori_adi FROM kategoriler ORDER BY kategori_adi ASC');
        return rows;
    }

    static async getAllBrands() {
        // simulationController line 23
        const [rows] = await db.execute('SELECT id, marka_adi FROM markalar ORDER BY marka_adi ASC');
        return rows;
    }
}

module.exports = MetaDataModel;
