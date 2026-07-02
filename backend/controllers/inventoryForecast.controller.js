const { GoogleGenerativeAI } = require("@google/generative-ai");
const Inventory = require("../models/inventory.model");
const Order = require("../models/order.model");

// Lazy-load Gemini — če API_KEY manjka, fallback na statistiko
let genAI = null;
let model = null;
const getGeminiModel = () => {
    if (!process.env.GEMINI_API_KEY) return null;
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    }
    return model;
};

/**
 * Zbere zgodovino porabe za vsak inventory item v zadnjih N dneh.
 * Vrne: [{ itemId, name, category, totalUsed, dailyAvg, currentStock, reorderLevel, daysUntilDepletion }]
 */
const getConsumptionData = async (days = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Agregiraj order items v zadnjih N dneh — kateri MenuItem-i so bili naročeni
    const orderItems = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
                status: { $ne: "Cancelled" }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.menuItem",
                totalQuantity: { $sum: "$items.quantity" },
                orderCount: { $sum: 1 },
            }
        },
        {
            $lookup: {
                from: "menuitems",
                localField: "_id",
                foreignField: "_id",
                as: "menuItem"
            }
        },
        { $unwind: "$menuItem" },
        { $match: { "menuItem.costPrice": { $exists: true } } }
    ]);

    // Pridobi vse inventory item-e
    const inventory = await Inventory.find().lean();

    // Za vsak inventory item, poišči povezane menu item-e (po kategoriji ali imenu)
    // In izračunaj porabo
    const consumptionData = inventory.map(inv => {
        // Preprosta hevristika: poveži inventory.category z menu category
        // V realni aplikaciji bi imeli recipe/BoM (Bill of Materials)
        const relatedOrders = orderItems.filter(oi =>
            oi.menuItem.name.toLowerCase().includes(inv.name.toLowerCase().split(" ")[0]) ||
            oi.menuItem.category === inv.category
        );

        const totalUsed = relatedOrders.reduce((sum, oi) => sum + oi.totalQuantity, 0);
        const dailyAvg = totalUsed / days;

        // Predvidena poraba v naslednjih 7 dneh
        const weeklyForecast = dailyAvg * 7;

        // Dnevi do izčrpanja (če je dailyAvg > 0)
        const daysUntilDepletion = dailyAvg > 0
            ? Math.floor(inv.quantity / dailyAvg)
            : null;

        // Ali je potrebno naročiti (če bo zmanjkalo v 7 dneh ali je pod reorder level)
        const needsReorder = inv.quantity <= inv.reorderLevel ||
            (daysUntilDepletion !== null && daysUntilDepletion <= 7);

        return {
            inventoryId: inv._id,
            name: inv.name,
            category: inv.category,
            unit: inv.unit,
            currentStock: inv.quantity,
            reorderLevel: inv.reorderLevel,
            supplier: inv.supplier,
            costPerUnit: inv.costPerUnit,
            totalUsedLastNDays: totalUsed,
            dailyAverage: Number(dailyAvg.toFixed(2)),
            weeklyForecast: Number(weeklyForecast.toFixed(2)),
            daysUntilDepletion,
            needsReorder,
        };
    });

    return consumptionData;
};

/**
 * GET /api/inventory/forecast
 * Vri AI napoved porabe z Gemini, s fallback na statistiko.
 *
 * Query: days (default 30) — koliko dni zgodovine uporabiti
 */
const getForecast = async (req, res, next) => {
    try {
        const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
        const consumptionData = await getConsumptionData(days);

        if (consumptionData.length === 0) {
            return res.status(200).json({
                success: true,
                forecast: {
                    summary: "No inventory data available for forecasting.",
                    items: [],
                    recommendations: [],
                    aiPowered: false,
                }
            });
        }

        const aiModel = getGeminiModel();

        if (!aiModel) {
            // Fallback: preprosta statistična napoved brez AI
            const lowStock = consumptionData.filter(d => d.needsReorder);
            return res.status(200).json({
                success: true,
                forecast: {
                    summary: `Statistical forecast based on ${days} days of data (AI disabled — set GEMINI_API_KEY to enable).`,
                    items: consumptionData,
                    recommendations: lowStock.map(d => ({
                        item: d.name,
                        action: "REORDER",
                        urgency: d.daysUntilDepletion !== null && d.daysUntilDepletion <= 3 ? "HIGH" : "MEDIUM",
                        currentStock: d.currentStock,
                        reorderLevel: d.reorderLevel,
                        suggestedOrderQty: Math.ceil(d.weeklyForecast * 2 - d.currentStock),
                        reason: d.daysUntilDepletion !== null
                            ? `Will deplete in ${d.daysUntilDepletion} days at current rate`
                            : `Below reorder level (${d.currentStock} ${d.unit} ≤ ${d.reorderLevel} ${d.unit})`,
                    })),
                    aiPowered: false,
                    period: { days, startDate: new Date(Date.now() - days * 86400000).toISOString() },
                }
            });
        }

        // AI forecast z Gemini
        const prompt = `
You are an inventory forecasting AI for a restaurant POS system.
Analyze the following inventory data and provide actionable insights.

DATA (last ${days} days):
${JSON.stringify(consumptionData, null, 2)}

Provide a JSON response with:
1. "summary" — 1-2 sentence overview of inventory health
2. "insights" — 3 bullet points highlighting key patterns (trends, anomalies, opportunities)
3. "recommendations" — array of { item, action, urgency, suggestedOrderQty, reason }
   - action: "REORDER" | "INCREASE_STOCK" | "DECREASE_STOCK" | "MONITOR"
   - urgency: "HIGH" | "MEDIUM" | "LOW"
   - suggestedOrderQty: number (in same unit as inventory)
   - reason: short explanation
4. "predictedShortages" — array of { item, expectedDate, probability (0-1) }

CRITICAL:
- Be specific and actionable
- Consider supplier lead times (assume 3 days default)
- Consider weekends have 30% higher consumption
- Return ONLY valid JSON, no markdown

Respond in JSON format.
        `;

        try {
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            // Clean markdown code blocks if present
            text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

            let aiResponse;
            try {
                aiResponse = JSON.parse(text);
            } catch (_e) {
                // Fallback če AI ni vrnil veljavnega JSON-a
                return res.status(200).json({
                    success: true,
                    forecast: {
                        summary: `AI returned non-JSON response. Showing statistical fallback.`,
                        items: consumptionData,
                        recommendations: consumptionData.filter(d => d.needsReorder).map(d => ({
                            item: d.name,
                            action: "REORDER",
                            urgency: d.daysUntilDepletion !== null && d.daysUntilDepletion <= 3 ? "HIGH" : "MEDIUM",
                            suggestedOrderQty: Math.ceil(d.weeklyForecast * 2 - d.currentStock),
                            reason: `Statistical: ${d.daysUntilDepletion} days until depletion`,
                        })),
                        aiPowered: false,
                        rawAiResponse: text.substring(0, 500),
                        period: { days, startDate: new Date(Date.now() - days * 86400000).toISOString() },
                    }
                });
            }

            res.status(200).json({
                success: true,
                forecast: {
                    ...aiResponse,
                    items: consumptionData,
                    aiPowered: true,
                    period: { days, startDate: new Date(Date.now() - days * 86400000).toISOString() },
                }
            });
        } catch (aiError) {
            console.error("Gemini AI error:", aiError.message);
            // Fallback na statistiko
            const lowStock = consumptionData.filter(d => d.needsReorder);
            return res.status(200).json({
                success: true,
                forecast: {
                    summary: `AI service unavailable — statistical fallback (${aiError.message}).`,
                    items: consumptionData,
                    recommendations: lowStock.map(d => ({
                        item: d.name,
                        action: "REORDER",
                        urgency: d.daysUntilDepletion !== null && d.daysUntilDepletion <= 3 ? "HIGH" : "MEDIUM",
                        suggestedOrderQty: Math.ceil(d.weeklyForecast * 2 - d.currentStock),
                        reason: d.daysUntilDepletion !== null
                            ? `Will deplete in ${d.daysUntilDepletion} days`
                            : `Below reorder level`,
                    })),
                    aiPowered: false,
                    error: aiError.message,
                    period: { days, startDate: new Date(Date.now() - days * 86400000).toISOString() },
                }
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/inventory/forecast/low-stock
 * Vri samo item-e, ki potrebujejo reorder (brez AI)
 */
const getLowStock = async (req, res, next) => {
    try {
        const days = 30;
        const consumptionData = await getConsumptionData(days);
        const lowStock = consumptionData.filter(d => d.needsReorder);

        res.status(200).json({
            success: true,
            count: lowStock.length,
            items: lowStock,
            period: { days, startDate: new Date(Date.now() - days * 86400000).toISOString() },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getForecast, getLowStock, getConsumptionData };
