const AdminModel = require('../models/AdminModel');

// --- HELPER FUNCTIONS ---
const getStoreForCustomer = (stores, storesByCity, customerSehirId) => {
    const useSameCity = Math.random() < 0.9; // 90% chance

    if (useSameCity && storesByCity[customerSehirId] && storesByCity[customerSehirId].length > 0) {
        const cityStores = storesByCity[customerSehirId];
        return cityStores[Math.floor(Math.random() * cityStores.length)];
    }

    // 10% chance: Random store (travel/tourism)
    if (stores.length > 0) {
        return stores[Math.floor(Math.random() * stores.length)].id;
    }

    return null;
};

const getRandomDate = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const day = Math.floor(Math.random() * daysInMonth) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getRandomProduct = (products, year, month, maxRetries = 50) => {
    for (let i = 0; i < maxRetries; i++) {
        const product = products[Math.floor(Math.random() * products.length)];

        // CRITICAL CHECK: Product release date validation
        if (product.cikis_yili > year) {
            continue; // Product not released yet - RETRY
        }

        if (product.cikis_yili === year) {
            // If released in current year, assume release is Month 9 (September)
            if (month < 9) {
                continue; // Product not released yet - RETRY
            }
        }

        return product; // Valid product
    }

    // Fallback: Return first available product if all retries failed
    return products.find(p => p.cikis_yili <= year) || products[0];
};

const getQuantity = () => {
    return Math.random() < 0.85 ? 1 : 2;
};

// --- CONTROLLER METHODS ---

exports.regenerateData = async (req, res) => {
    try {
        const startTime = Date.now();

        // 1. WIPE: Truncate the table
        await AdminModel.truncateTable('satis_gecmisi');
        console.log('✓ satis_gecmisi table truncated');

        // 2. FETCH METADATA
        const customers = await AdminModel.getCustomers(20000);
        console.log(`✓ Loaded ${customers.length} customers into memory`);

        const stores = await AdminModel.getStores();
        console.log(`✓ Loaded ${stores.length} stores into memory`);

        // Create a map: city_id -> array of store IDs for quick lookup
        const storesByCity = {};
        stores.forEach(store => {
            if (!storesByCity[store.sehir_id]) {
                storesByCity[store.sehir_id] = [];
            }
            storesByCity[store.sehir_id].push(store.id);
        });

        const products = await AdminModel.getProducts();
        console.log(`✓ Loaded ${products.length} products into memory`);

        // PHASE 1: Sales Generation
        const salesBuffer = [];
        const years = [2023, 2024, 2025];
        const baseYear = 2023;

        console.log('🔄 Generating sales data...');

        for (const year of years) {
            console.log(`  → Processing year ${year}...`);

            for (const customer of customers) {
                const rand = Math.random();
                let transactionCount = 0;
                if (rand < 0.40) transactionCount = 1;
                else if (rand < 0.90) transactionCount = 2;
                else transactionCount = 0;

                for (let t = 0; t < transactionCount; t++) {
                    const month = Math.floor(Math.random() * 12) + 1;
                    const salesDate = getRandomDate(year, month);

                    const monthsPassed = (year - baseYear) * 12 + (month - 1);
                    const inflationMultiplier = 1 + (0.025 * monthsPassed);

                    const storeId = getStoreForCustomer(stores, storesByCity, customer.sehir_id);
                    if (!storeId) continue;

                    const product = getRandomProduct(products, year, month);
                    if (!product) continue;

                    const quantity = getQuantity();
                    const basePrice = product.satis_fiyati || 10000;
                    const unitPrice = basePrice * inflationMultiplier;
                    const revenue = Math.round(unitPrice * quantity);
                    const costPercentage = 0.65 + Math.random() * 0.20;
                    const cost = Math.round(revenue * costPercentage);

                    salesBuffer.push([
                        storeId,
                        customer.id,
                        product.id,
                        salesDate,
                        quantity,
                        Math.round(unitPrice),
                        revenue,
                        cost
                    ]);
                }
            }
        }

        console.log(`✓ Generated ${salesBuffer.length} sales records in memory`);

        // 6. BATCH INSERT
        const BATCH_SIZE = 2000;
        let insertedCount = 0;

        console.log('💾 Inserting records in batches...');

        for (let i = 0; i < salesBuffer.length; i += BATCH_SIZE) {
            const batch = salesBuffer.slice(i, i + BATCH_SIZE);
            await AdminModel.batchInsertSales(batch);
            insertedCount += batch.length;

            if ((i / BATCH_SIZE) % 50 === 0) {
                console.log(`  → Inserted ${insertedCount.toLocaleString()} / ${salesBuffer.length.toLocaleString()} records...`);
            }
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✓ Inserted ${insertedCount.toLocaleString()} sales records in ${duration} seconds`);

        // PHASE 2: Market Share Fix
        console.log('📊 Calibrating Market Potential...');

        const storeRevenues = await AdminModel.getStoreRevenues();
        let updatedStores = 0;

        for (const store of storeRevenues) {
            const totalStoreRevenue = parseFloat(store.toplam_ciro_total) || 0;

            if (totalStoreRevenue <= 0) {
                const minimalMarketPotential = 10000000;
                const newSuccessScore = Math.round(75 + Math.random() * 23);
                await AdminModel.updateStorePotential(store.magaza_id, minimalMarketPotential, newSuccessScore);
                updatedStores++;
                continue;
            }

            const targetShare = 0.05 + Math.random() * 0.10; // 5-15%
            const newMarketPotential = Math.round(totalStoreRevenue / targetShare);
            const newSuccessScore = Math.round(75 + Math.random() * 23);

            await AdminModel.updateStorePotential(store.magaza_id, newMarketPotential, newSuccessScore);
            updatedStores++;
        }

        const finalEndTime = Date.now();
        const totalDuration = ((finalEndTime - startTime) / 1000).toFixed(2);

        // Stats for response
        const totalRevenue = salesBuffer.reduce((sum, sale) => sum + sale[6], 0); // sale[6] is revenue
        const revenueInMillions = (totalRevenue / 1000000).toFixed(1);

        const totalMarketPotential = await AdminModel.getTotalMarketPotential();
        const marketPotentialInBillions = (totalMarketPotential / 1000000000).toFixed(2);

        const calculatedMarketShare = totalRevenue > 0 && totalMarketPotential > 0
            ? ((totalRevenue / totalMarketPotential) * 100).toFixed(1)
            : 0;

        const storeSharesRows = await AdminModel.getStoreMarketShares();
        const marketShares = storeSharesRows.map(s => parseFloat(s.market_share) || 0).filter(s => s > 0);
        const minShare = marketShares.length > 0 ? Math.min(...marketShares).toFixed(1) : 0;
        const maxShare = marketShares.length > 0 ? Math.max(...marketShares).toFixed(1) : 0;
        const avgShare = marketShares.length > 0
            ? (marketShares.reduce((a, b) => a + b, 0) / marketShares.length).toFixed(1)
            : 0;

        const avgTransactionsPerYear = (insertedCount / customers.length / 3).toFixed(2);

        res.send(`✅ Database regenerated and calibrated successfully!<br>
            📦 Sales: ${insertedCount.toLocaleString()} records (3 years: 2023-2025)<br>
            👥 Customers: ${customers.length} × avg ${avgTransactionsPerYear} transactions/year<br>
            💰 Total Revenue (3 years): ~${revenueInMillions}M TL<br>
            🌍 Total Market Potential: ~${marketPotentialInBillions}B TL<br>
            📊 Overall Market Share: ~${calculatedMarketShare}%<br>
            📈 Per-Store Market Share Range: ${minShare}% - ${maxShare}% (Avg: ${avgShare}%)<br>
            ✅ Market Share guaranteed between 5-15% per store<br>
            ⏱️ Duration: ${totalDuration}s`);

    } catch (error) {
        console.error('❌ Error during data regeneration:', error);
        res.status(500).send('Error: ' + error.message);
    }
};

exports.calibrateMarketShare = async (req, res) => {
    try {
        const startTime = Date.now();

        console.log('📊 Starting Market Share Calibration (3-7% target)...');

        const storeRevenues = await AdminModel.getStoreRevenues();
        console.log(`✓ Analyzed revenue for ${storeRevenues.length} stores`);

        let updatedStores = 0;
        let skippedStores = 0;
        const marketShares = [];

        for (const store of storeRevenues) {
            const storeRevenue = parseFloat(store.toplam_ciro_total) || 0;

            if (storeRevenue <= 0) {
                const minimalMarketPotential = 10000000;
                const newSuccessScore = Math.round(80 + Math.random() * 15);
                await AdminModel.updateStorePotential(store.magaza_id, minimalMarketPotential, newSuccessScore);
                skippedStores++;
                continue;
            }

            const targetPercentage = 0.03 + Math.random() * 0.04; // 3-7%
            const newMarketPotential = Math.round(storeRevenue / targetPercentage);
            const finalMarketPotential = Math.max(newMarketPotential, storeRevenue * 10);
            const newSuccessScore = Math.round(80 + Math.random() * 15);

            await AdminModel.updateStorePotential(store.magaza_id, finalMarketPotential, newSuccessScore);

            const actualMarketShare = (storeRevenue / finalMarketPotential) * 100;
            marketShares.push(actualMarketShare);
            updatedStores++;
        }

        console.log(`✓ Updated market potential for ${updatedStores} stores`);

        const minShare = marketShares.length > 0 ? Math.min(...marketShares).toFixed(2) : 0;
        const maxShare = marketShares.length > 0 ? Math.max(...marketShares).toFixed(2) : 0;
        const avgShare = marketShares.length > 0
            ? (marketShares.reduce((a, b) => a + b, 0) / marketShares.length).toFixed(2)
            : 0;

        const totalRevenue = storeRevenues.reduce((sum, s) => sum + (parseFloat(s.toplam_ciro_total) || 0), 0);
        const totalMarketPotential = await AdminModel.getTotalMarketPotential();
        const overallMarketShare = totalRevenue > 0 && totalMarketPotential > 0
            ? ((totalRevenue / totalMarketPotential) * 100).toFixed(2)
            : 0;

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        res.send(`✅ Market Share Calibration Complete!<br>
            📊 Updated: ${updatedStores} stores<br>
            ⚠️  Skipped: ${skippedStores} stores (zero revenue)<br>
            📈 Per-Store Market Share Range: ${minShare}% - ${maxShare}% (Avg: ${avgShare}%)<br>
            📊 Overall Market Share: ${overallMarketShare}%<br>
            💰 Total Revenue: ~${(totalRevenue / 1000000).toFixed(1)}M TL<br>
            🌍 Total Market Potential: ~${(totalMarketPotential / 1000000000).toFixed(2)}B TL<br>
            ✅ All stores calibrated to 3-7% Market Share range<br>
            ⏱️ Duration: ${duration}s<br>
            <br>
            <strong>Note:</strong> Sales data (satis_gecmisi) was NOT modified. Only magazalar table was updated.`);

    } catch (error) {
        console.error('❌ Error during market share calibration:', error);
        res.status(500).send('Error: ' + error.message);
    }
};
