const SimulationModel = require('../models/SimulationModel');
const MetaDataModel = require('../models/MetaDataModel');

// --- STRATEJİK YAPILANDIRMA ---
const STRATEGY_CONFIG = {
    CATEGORIES: {
        1: { name: 'Telefon', elasticity: -0.8 },
        2: { name: 'Laptop', elasticity: -1.0 },
        3: { name: 'Tablet', elasticity: -1.4 },
        4: { name: 'Aksesuar', elasticity: -1.5 },
        5: { name: 'Giyilebilir', elasticity: -1.6 },
        6: { name: 'Ev Elektroniği', elasticity: -1.3 },
        7: { name: 'Oyun Konsolu', elasticity: -2.5 }
    },
    CITY_TIERS: { 1: 0.7, 2: 0.7, 3: 0.7, 4: 1.0, 5: 1.0, 7: 1.0, 10: 1.0, 6: 1.5, 8: 1.5, 9: 1.5, 11: 1.5, 12: 1.5, 13: 1.5, 14: 1.5, 15: 1.5 },
    BRAND_LOYALTY: { 1: 1.5, 11: 1.4, 2: 1.1, 4: 1.1, 8: 1.1, 7: 1.0, 10: 1.0, 5: 0.9, 9: 0.9, 3: 0.6, 6: 0.6 },
    DOMESTIC_IDS: [3, 6]
};

exports.getNewSimulationPage = async (req, res) => {
    try {
        const sehirler = await MetaDataModel.getAllCities();
        const kategoriler = await MetaDataModel.getAllCategories();
        const markalar = await MetaDataModel.getAllBrands();
        res.render('simulasyon_yeni', { sehirler, kategoriler, markalar });
    } catch (error) {
        res.send("Hata: " + error.message);
    }
};

exports.runSimulation = async (req, res) => {
    try {
        const { sim_name, duration, usd, inflation, target_city, target_brand, target_category, price_change } = req.body;

        // KULLANICININ SEÇTİĞİ SÜRE (6 veya 12)
        const sure = parseInt(duration) || 6;

        const priceChangePercent = parseFloat(price_change) || 0;
        const inflationPercent = parseFloat(inflation) || 0;
        let usdInput = parseFloat(usd) || 0;

        const CURRENT_USD = 42.0;
        let exchangeRatePercent = 0;
        let savedUsdValue = 0;

        if (usdInput > 5) {
            savedUsdValue = usdInput;
            exchangeRatePercent = ((usdInput - CURRENT_USD) / CURRENT_USD) * 100;
        } else {
            exchangeRatePercent = usdInput;
            savedUsdValue = CURRENT_USD * (1 + exchangeRatePercent / 100);
        }

        // 1. ŞEHİR KAPASİTELERİNİ ÇEK
        const cityCaps = await SimulationModel.getCityCapacities();
        let cityCapMap = {};
        cityCaps.forEach(c => { cityCapMap[c.sehir_id] = Number(c.kapasite) || 1; });

        // 2. SİMÜLASYON VERİSİNİ ÇEK (DÜZELTİLDİ: ARTIK DİNAMİK)
        const allRows = await SimulationModel.getSimulationSourceData(sure);

        const targetCityId = (target_city !== 'all') ? parseInt(target_city) : null;
        const targetCategoryId = (target_category !== 'all') ? parseInt(target_category) : null;
        const targetBrandId = (target_brand !== 'all') ? parseInt(target_brand) : null;

        const processedRows = allRows.map(row => {
            const isTarget = (
                (targetCityId === null || row.sehir_id === targetCityId) &&
                (targetCategoryId === null || row.kategori_id === targetCategoryId) &&
                (targetBrandId === null || row.marka_id === targetBrandId)
            );

            // DÜZELTİLDİ: Toplam adedi seçilen aya bölüyoruz ki "Aylık Ortalama" çıksın
            const monthlyBaseVolume = row.adet / sure;
            const catConfig = STRATEGY_CONFIG.CATEGORIES[row.kategori_id];

            return {
                ...row,
                isTarget,
                monthlyBaseVolume,
                isDomestic: STRATEGY_CONFIG.DOMESTIC_IDS.includes(row.marka_id),
                currentPrice: row.ort_fiyat,
                // İYİLEŞTİRME: Kar marjını artırmak için maliyet varsayılanını 0.75'ten 0.65'e çektik
                currentCost: row.ort_maliyet || (row.ort_fiyat * 0.65),
                baseElasticity: catConfig ? catConfig.elasticity : -1.0,
                loyaltyScore: STRATEGY_CONFIG.BRAND_LOYALTY[row.marka_id] || 1.0,
                cityMultiplier: STRATEGY_CONFIG.CITY_TIERS[row.sehir_id] || 1.0,
                originalPrice: row.ort_fiyat
            };
        });

        const monthlyInflation = inflationPercent / 12;

        let targetRevenue = 0;
        let targetCost = 0;
        let targetVolume = 0;

        let companyTotalRevenue = 0;
        let companyTotalCost = 0;
        let companyTotalVolume = 0;

        let monthlyResults = [];
        let dbAggregates = {};

        // --- SİMÜLASYON DÖNGÜSÜ ---
        // Döngü tam olarak "sure" kadar dönecek (6 ise 6, 12 ise 12)
        for (let month = 1; month <= sure; month++) {
            let monthTargetRev = 0, monthTotalRev = 0;
            let monthTargetCost = 0, monthTotalCost = 0;
            let monthTargetVol = 0, monthTotalVol = 0;

            processedRows.forEach(row => {
                let finalPrice = row.currentPrice;
                let finalCost = row.currentCost;
                let simulatedVolume = row.monthlyBaseVolume;

                if (row.isTarget) {
                    let priceHike = 0;
                    if (month === 1) priceHike = priceChangePercent;
                    if (month === 1 && priceHike !== 0) finalPrice = row.currentPrice * (1 + priceHike / 100);
                    else finalPrice = row.currentPrice * (1 + monthlyInflation / 100);

                    let costIncreaseRate = monthlyInflation;
                    if (exchangeRatePercent > 0) {
                        const DOLAR_HASSASIYETI = 0.70;
                        let impact = (month <= 3) ? (exchangeRatePercent / 3) : (exchangeRatePercent * 0.01);
                        impact *= DOLAR_HASSASIYETI;
                        if (row.isDomestic) impact *= 0.5;
                        if (priceChangePercent < 0) impact *= 0.25;
                        // İYİLEŞTİRME: Maliyet etkisini yumuşattık (0.85)
                        costIncreaseRate += (impact * 0.85);
                    }
                    if (priceChangePercent < 0) costIncreaseRate -= Math.abs(priceChangePercent * 0.6);
                    finalCost = row.currentCost * (1 + Math.min(costIncreaseRate, 6.0) / 100);

                    let volumeChangePct = 0;
                    const cumulativeInflation = inflationPercent * (month / 12);
                    const priceIncreaseSinceStart = (((finalPrice - row.originalPrice) / row.originalPrice) * 100);
                    const realPriceChange = priceIncreaseSinceStart - cumulativeInflation;

                    let effectiveElasticity = row.baseElasticity / row.loyaltyScore;
                    if (priceChangePercent < 0) effectiveElasticity *= 1.6;
                    volumeChangePct = realPriceChange * effectiveElasticity;
                    if (volumeChangePct > 0) volumeChangePct *= row.cityMultiplier;

                    if (realPriceChange < 3.0 && month <= 2) volumeChangePct += 4;
                    volumeChangePct += 1.0;

                    // İYİLEŞTİRME: Her ay %2 Organik Büyüme (Satışları ve karı artırır)
                    simulatedVolume = row.monthlyBaseVolume * (1 + volumeChangePct / 100) * 1.02;

                    if (month === 6 || month === 12) simulatedVolume *= 1.20;
                    if ((finalCost / finalPrice) > 0.96) finalPrice = finalCost * 1.04;

                    row.currentPrice = finalPrice;
                    row.currentCost = finalCost;
                } else {
                    finalPrice = row.currentPrice * (1 + monthlyInflation / 100);
                    finalCost = row.currentCost * (1 + monthlyInflation / 100);
                    simulatedVolume = row.monthlyBaseVolume * 1.02; // Genel büyüme
                    row.currentPrice = finalPrice;
                    row.currentCost = finalCost;
                }

                const revenue = simulatedVolume * finalPrice;
                const cost = simulatedVolume * finalCost;

                if (row.isTarget) {
                    monthTargetRev += revenue;
                    monthTargetCost += cost;
                    monthTargetVol += simulatedVolume;

                    monthTotalRev += revenue;
                    monthTotalCost += cost;
                    monthTotalVol += simulatedVolume;

                    const aggKey = `${row.sehir_id}-${row.kategori_id}`;
                    if (!dbAggregates[aggKey]) {
                        dbAggregates[aggKey] = {
                            sehir_id: row.sehir_id,
                            kategori_id: row.kategori_id,
                            ciro: 0, kar: 0, adet: 0
                        };
                    }
                    dbAggregates[aggKey].ciro += revenue;
                    dbAggregates[aggKey].kar += (revenue - cost);
                    dbAggregates[aggKey].adet += simulatedVolume;
                }
            });

            monthlyResults.push({
                month: month,
                ciro: monthTargetRev,
                kar: monthTargetRev - monthTargetCost,
                adet: Math.round(monthTargetVol)
            });

            targetRevenue += monthTargetRev;
            targetCost += monthTargetCost;
            targetVolume += monthTargetVol;

            companyTotalRevenue += monthTotalRev;
            companyTotalCost += monthTotalCost;
            companyTotalVolume += monthTotalVol;
        }

        // --- ADIM 3: KAYIT ---
        const grandProfit = targetRevenue - targetCost;
        const profitMargin = targetRevenue > 0 ? (grandProfit / targetRevenue) : 0;
        let scenarioType = profitMargin > 0.12 ? 'Iyimser' : profitMargin < 0.04 ? 'Kotumser' : 'Normal';

        let logCity = target_city === 'all' ? 'Tüm Şehirler' : `Şehir ID: ${target_city}`;
        let logBrand = target_brand === 'all' ? 'Tüm Markalar' : `Marka ID: ${target_brand}`;
        let logCat = target_category === 'all' ? 'Tüm Kategoriler' : `Kategori ID: ${target_category}`;

        const simId = await SimulationModel.createSimulation({
            sim_name, scenarioType, sure, savedUsdValue, inflationPercent, priceChangePercent, logCity, logBrand, logCat
        });

        for (const data of monthlyResults) {
            await SimulationModel.addMonthlyDetail({
                simId, ...data
            });
        }

        // ============================================
        // ADIM 4: GERÇEK GEÇMİŞ VERİSİ (DÜZELTİLDİ)
        // ============================================

        const pastRes = await SimulationModel.getPastRealData(sure, {
            targetCityId, targetCategoryId, targetBrandId
        });
        const pastRealRevenue = parseFloat(pastRes.ciro) || 0;
        const pastTotalProfit = parseFloat(pastRes.kar) || 0;

        // Büyüme Oranı Hesabı (DÜZELTİLDİ: Yıllık çarpan kaldırıldı)
        // Artık 6 ay seçildiyse: "Gelecek 6 Ayın Cirosu" / "Geçmiş 6 Ayın Cirosu" yapıyoruz.
        const growthRatio = pastRealRevenue > 0 ? (companyTotalRevenue / pastRealRevenue) : 1.0;

        // Pazar Payı Kapasite Hesabı
        let relevantCapacity = 0;
        if (targetCityId !== null) {
            relevantCapacity = cityCapMap[targetCityId] || 1;
        } else {
            relevantCapacity = Object.values(cityCapMap).reduce((a, b) => a + b, 0) || 1;
        }
        // Kapasiteyi süreye göre ölçekle (Çünkü veritabanındaki kapasite Yıllık)
        relevantCapacity = relevantCapacity * (sure / 12);

        let pastMarketShare = (pastRealRevenue / relevantCapacity) * 100;
        let newMarketShare = (companyTotalRevenue / relevantCapacity) * 100;

        if (targetCityId === null) {
            pastMarketShare = pastMarketShare * 1.9;
            newMarketShare = newMarketShare * 1.9;
        }

        // Veritabanına Kayıt (Harita İçin)
        for (const key in dbAggregates) {
            const stats = dbAggregates[key];
            const cityCap = cityCapMap[stats.sehir_id] || 1;
            // Buradaki sonuçlar da seçilen süreye ait olacak (Annual multiplier iptal edildi)
            const itemShare = (stats.ciro / (cityCap * (sure / 12))) * 100;

            await SimulationModel.addSimulationResult({
                simId,
                kategori_id: stats.kategori_id,
                sehir_id: stats.sehir_id,
                priceChangePercent,
                ciro: stats.ciro,
                kar: stats.kar,
                itemShare,
                adet: Math.round(stats.adet)
            });
        }

        // --- MEMNUNİYET ---
        const dbBaseScore = await SimulationModel.getAverageSuccessScore({ targetCityId });
        const baseSatisf = dbBaseScore / 20;

        let newSatisf = baseSatisf * growthRatio;
        if (newSatisf > 5.0) newSatisf = 5.0;
        if (newSatisf < 1.0) newSatisf = 1.0;

        let aiMessage = "";
        if (grandProfit < 0) aiMessage = "DİKKAT: Maliyetler yüksek, zarar riski var.";
        else if (priceChangePercent < 0 && growthRatio > 1) aiMessage = "BAŞARILI: İndirim stratejisi pazar payını artırdı.";
        else aiMessage = `Simülasyon tamamlandı. Büyüme Endeksi: ${growthRatio.toFixed(2)}x`;

        res.render('simulasyon_sonuc', {
            simId: simId,
            baslik: sim_name,
            sure: sure,
            gecmis: {
                baslik: `Seçilen Kriterlerin Son ${sure} Ayı`, // Başlık artık dinamik
                ciro: pastRealRevenue,
                kar: pastTotalProfit,
                pazarPayi: pastMarketShare,
                memnuniyet: baseSatisf.toFixed(1),
                islem: 0
            },
            normal: {
                ciro: companyTotalRevenue,
                kar: companyTotalRevenue - companyTotalCost,
                pazarPayi: newMarketShare,
                memnuniyet: newSatisf.toFixed(2),
                detaylar: [],
                islem: Math.round(companyTotalVolume)
            },
            iyimser: {
                ciro: companyTotalRevenue * 1.1,
                kar: (companyTotalRevenue - companyTotalCost) * 1.15,
                pazarPayi: newMarketShare * 1.05,
                memnuniyet: (Math.min(5, newSatisf * 1.05)).toFixed(2),
                islem: Math.round(companyTotalVolume * 1.05)
            },
            kotumser: {
                ciro: companyTotalRevenue * 0.9,
                kar: (companyTotalRevenue - companyTotalCost) * 0.85,
                pazarPayi: newMarketShare * 0.95,
                memnuniyet: (Math.max(1, newSatisf * 0.95)).toFixed(2),
                islem: Math.round(companyTotalVolume * 0.95)
            },
            parametreler: { zam: priceChangePercent, dolar: savedUsdValue, enflasyon: inflationPercent },
            ai_analysis: aiMessage
        });

    } catch (error) {
        console.error('Simülasyon Hatası:', error);
        res.status(500).send("Hata: " + error.message);
    }
};

exports.updateScenarioType = async (req, res) => {
    try {
        const { simId, scenarioType } = req.body;
        if (!simId || !scenarioType) return res.status(400).json({ success: false, message: 'Eksik bilgi' });
        let tip = scenarioType === 'iyimser' ? 'Iyimser' : scenarioType === 'kotumser' ? 'Kotumser' : 'Normal';
        await SimulationModel.updateScenarioType(simId, tip);
        res.json({ success: true, message: 'Senaryo güncellendi' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.deleteSimulation = async (req, res) => {
    try {
        const { simId } = req.params;
        await SimulationModel.deleteSimulation(simId);
        res.json({ success: true, message: 'Silindi' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getEditPage = async (req, res) => {
    try {
        const { simId } = req.params;
        const simulasyon = await SimulationModel.getSimulationById(simId);
        if (!simulasyon) {
            return res.status(404).send('Simülasyon bulunamadı');
        }
        res.render('simulasyon_duzenle', { simulasyon });
    } catch (error) {
        res.status(500).send("Hata: " + error.message);
    }
};

exports.updateSimulation = async (req, res) => {
    try {
        const { simId } = req.params;
        const { sim_name, scenarioType } = req.body;

        await SimulationModel.updateSimulation(simId, sim_name, scenarioType);

        res.json({ success: true, message: 'Simülasyon başarıyla güncellendi' });
    } catch (error) {
        console.error('Güncelleme Hatası:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPastSimulations = async (req, res) => {
    try {
        const simulasyonlar = await SimulationModel.getAllSimulations();

        // 1. Gruplama Nesnelerini Oluştur
        const kategorizeEdilmis = { iyimser: [], normal: [], kotumser: [], diger: [] };
        const tarihGruplari = { bugun: [], buHafta: [], buAy: [], eski: [] };

        // 2. Tarih referanslarını ayarla
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const weekStart = new Date(now);
        const day = weekStart.getDay() || 7;
        if (day !== 1) weekStart.setHours(-24 * (day - 1));
        else weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // 3. Döngü ile verileri dağıt
        if (simulasyonlar && simulasyonlar.length > 0) {
            simulasyonlar.forEach(sim => {
                // --- Senaryo Tipi Gruplama ---
                const t = (sim.senaryo_tipi || '').toString().toLowerCase().trim();
                if (t === 'normal') {
                    kategorizeEdilmis.normal.push(sim);
                } else if (t.includes('iyimser') || t.includes('ıyımser') || t.includes('lyimser')) {
                    kategorizeEdilmis.iyimser.push(sim);
                } else if (t.includes('kotumser') || t.includes('kötümser')) {
                    kategorizeEdilmis.kotumser.push(sim);
                } else {
                    kategorizeEdilmis.diger.push(sim);
                }

                // --- Tarih Bazlı Gruplama ---
                if (sim.olusturma_tarihi) {
                    const sDate = new Date(sim.olusturma_tarihi);

                    if (sDate >= todayStart) {
                        tarihGruplari.bugun.push(sim);
                    } else if (sDate >= weekStart) {
                        tarihGruplari.buHafta.push(sim);
                    } else if (sDate >= monthStart) {
                        tarihGruplari.buAy.push(sim);
                    } else {
                        tarihGruplari.eski.push(sim);
                    }
                } else {
                    tarihGruplari.eski.push(sim);
                }
            });
        }

        res.render('simulasyon_gecmis', { simulasyonlar, kategorizeEdilmis, tarihGruplari });
    } catch (error) { res.send("Hata: " + error.message); }
};