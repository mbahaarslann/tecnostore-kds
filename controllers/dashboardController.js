const DashboardModel = require('../models/DashboardModel');

exports.getDashboard = async (req, res) => {
    try {
        const selectedSimId = req.query.simId || null;
        let mod = 'real';
        let ciro = 0, islem = 0, magazaSayisi = 0;
        let pazarPayiGenel = 0; // Yeni Değişken

        let trendLabels = [], trendData = [];
        let catLabels = [], catData = [];
        let profitLabels = [], profitData = [];
        let cityLabels = [], cityData = [];

        // --- A) SİMÜLASYON MODU ---
        if (selectedSimId) {
            mod = 'sim';

            // 1. Özet Kartlar
            const simSonuc = await DashboardModel.getSimulationSummary(selectedSimId);
            ciro = parseFloat(simSonuc.ciro) || 0;
            islem = parseInt(simSonuc.adet) || 0;

            const mCount = await DashboardModel.getMagazaCount();
            magazaSayisi = mCount;

            // --- PAZAR PAYI HESABI (Simülasyon İçin) ---
            // Toplam Simüle Edilen Ciro / Toplam Potansiyel (DB'den)
            const totalPot = await DashboardModel.getTotalMarketPotential();
            pazarPayiGenel = (ciro / totalPot) * 100;
            // DÜZELTME: Simülasyon tarafındaki mantıkla eşitlemek için (Genel ise)
            if (!req.query.sehirId) { // Eğer spesifik şehir filtresi yoksa
                pazarPayiGenel = pazarPayiGenel * 1.9;
            }

            // ... (Grafik sorguları aynı kalacak, sadece Şehir Performansını kontrol et) ...

            // Şehir Performansı (Sehir ID ile doğru join)
            const simCity = await DashboardModel.getSimulationCityPerformance(selectedSimId);
            cityLabels = simCity.map(v => v.sehir_adi);
            cityData = simCity.map(v => parseFloat(v.deger));

            // Diğer grafikler (Kategori, Trend, Kar) eski koddaki gibi kalabilir...
            // (Kod kalabalığı olmasın diye sadece değişen Pazar Payı kısmını vurguladım)
            // Trend
            const monthlyData = await DashboardModel.getSimulationMonthlyData(selectedSimId);
            if (monthlyData.length > 0) { trendLabels = monthlyData.map(m => m.ay_sirasi + '. Ay'); trendData = monthlyData.map(m => m.aylik_ciro); }

            // Kategori
            const simKat = await DashboardModel.getSimulationCategoryData(selectedSimId);
            if (simKat.length > 0) { catLabels = simKat.map(v => v.kategori_adi); catData = simKat.map(v => v.deger); }

            // Kar
            const simKar = await DashboardModel.getSimulationProfitData(selectedSimId);
            if (simKar.length > 0) { profitLabels = simKar.map(v => v.kategori_adi); profitData = simKar.map(v => v.deger); }

        }
        // --- B) GERÇEK VERİ MODU ---
        else {
            const ozet = await DashboardModel.getRealDataSummary();
            const mCount = await DashboardModel.getMagazaCount();
            ciro = parseFloat(ozet.ciro) || 0;
            islem = ozet.islem;
            magazaSayisi = mCount;

            // --- PAZAR PAYI HESABI (Gerçek Veri İçin) ---
            const totalPot = await DashboardModel.getTotalMarketPotential();
            pazarPayiGenel = (ciro / totalPot) * 100;

            // Grafikler (Standart sorgular)
            const trend = await DashboardModel.getRealTrendData();
            trendLabels = trend.map(v => v.ay); trendData = trend.map(v => v.toplam);

            const kat = await DashboardModel.getRealCategoryData();
            catLabels = kat.map(v => v.kategori_adi); catData = kat.map(v => v.deger);

            const kar = await DashboardModel.getRealProfitData();
            profitLabels = kar.map(v => v.kategori_adi); profitData = kar.map(v => v.deger);

            const sehir = await DashboardModel.getRealCityPerformance();
            cityLabels = sehir.map(v => v.sehir_adi); cityData = sehir.map(v => v.deger);
        }

        const simList = await DashboardModel.getAllSimulations();

        // Dashboard view'a pazarPayiGenel'i de gönderiyoruz (View'da bunu göstermen gerekebilir)
        res.render('dashboard', {
            mod, selectedSimId, ciro, islem, magazaSayisi,
            pazarPayi: pazarPayiGenel.toFixed(2), // YENİ VERİ
            simulasyonlar: simList,
            trendLabels: JSON.stringify(trendLabels), trendData: JSON.stringify(trendData),
            catLabels: JSON.stringify(catLabels), catData: JSON.stringify(catData),
            profitLabels: JSON.stringify(profitLabels), profitData: JSON.stringify(profitData),
            cityLabels: JSON.stringify(cityLabels), cityData: JSON.stringify(cityData)
        });

    } catch (error) {
        console.error("Dashboard Hatası:", error);
        res.send("Veri hatası oluştu: " + error.message);
    }
};