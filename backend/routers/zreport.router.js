const express = require("express");
const router = express.Router();
const Order = require("../models/order.model");
const FiscalInvoice = require("../models/fiscalInvoice.model");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { format } = require("date-fns");

router.use(protectedRoute);

/**
 * GET /api/reports/z-report
 * Z-Report — dnevni zaključek blagajne (end-of-day reconciliation).
 *
 * Povzetek vseh transakcij za določen dan:
 *   - Skupni prihodek (z DDV)
 *   - DDV po stopnjah (22%, 9.5%, 5%)
 *   - Število računov
 *   - Povprečni račun
 *   - Po načinih plačila (cash, card, online, split)
 *   - Po vrsti (dine-in, takeaway, QR)
 *   - Storno/preklicana naročila
 *   - Service charge skupaj
 *   - Prvi in zadnji račun (zaporedne številke)
 *   - Cash drawer: začetno stanje + prihodki = končno stanje
 *
 * Query: date (YYYY-MM-DD, default danes)
 */
router.get("/z-report", requirePermission("reports:read"), async (req, res) => {
    try {
        const dateStr = req.query.date || format(new Date(), "yyyy-MM-dd");
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const matchStage = {
            createdAt: { $gte: startDate, $lte: endDate },
            status: "Completed",
        };

        // Vzporedno pridobi vse podatke
        const [orders, fiscalData, cancelledOrders, paymentBreakdown, orderTypeBreakdown] = await Promise.all([
            // Vsi dokončani naročili
            Order.find(matchStage)
                .populate("table", "name zone")
                .populate("user", "name")
                .sort({ createdAt: 1 })
                .lean(),

            // Fiskalni podatki
            FiscalInvoice.find({
                issueDateTime: { $gte: startDate, $lte: endDate },
                status: "confirmed",
            }).lean(),

            // Preklicana naročila
            Order.countDocuments({
                createdAt: { $gte: startDate, $lte: endDate },
                status: "Cancelled",
            }),

            // Po načinih plačila
            Order.aggregate([
                { $match: matchStage },
                { $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 },
                    total: { $sum: "$totalAmount" },
                }},
                { $sort: { total: -1 } },
            ]),

            // Po vrsti naročila
            Order.aggregate([
                { $match: matchStage },
                { $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    total: { $sum: "$totalAmount" },
                }},
            ]),
        ]);

        // Izračunaj DDV po stopnjah
        const taxBreakdown = {};
        orders.forEach(order => {
            const taxRate = 22; // privzeta stopnja (v produkciji pridobi iz CurrencySettings)
            const base = order.totalAmount / (1 + taxRate / 100);
            const tax = order.totalAmount - base;

            if (!taxBreakdown[taxRate]) {
                taxBreakdown[taxRate] = { base: 0, tax: 0, gross: 0, count: 0 };
            }
            taxBreakdown[taxRate].base += base;
            taxBreakdown[taxRate].tax += tax;
            taxBreakdown[taxRate].gross += order.totalAmount;
            taxBreakdown[taxRate].count++;
        });

        // Service charge skupaj
        const totalServiceCharge = orders.reduce((sum, o) => sum + (o.serviceCharge || 0), 0);

        // Skupni znesek
        const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalTax = Object.values(taxBreakdown).reduce((sum, t) => sum + t.tax, 0);
        const totalBase = Object.values(taxBreakdown).reduce((sum, t) => sum + t.base, 0);

        // Prvi in zadnji račun (zaporedne številke)
        const firstInvoice = fiscalData[0]?.invoiceNumber || "—";
        const lastInvoice = fiscalData[fiscalData.length - 1]?.invoiceNumber || "—";

        // Cash drawer reconciliation
        const cashOrders = orders.filter(o => o.paymentMethod === "Cash" || (o.payments && o.payments.some(p => p.method === "Cash")));
        const cashTotal = cashOrders.reduce((sum, o) => {
            if (o.payments && o.payments.length > 0) {
                return sum + o.payments.filter(p => p.method === "Cash").reduce((s, p) => s + p.amount, 0);
            }
            return sum + o.totalAmount;
        }, 0);

        const zReport = {
            date: dateStr,
            generatedAt: new Date().toISOString(),
            generatedBy: req.user?.name || "System",

            summary: {
                totalRevenue,
                totalBase,
                totalTax,
                totalServiceCharge,
                orderCount: orders.length,
                cancelledCount: cancelledOrders,
                avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
            },

            taxBreakdown: Object.entries(taxBreakdown).map(([rate, data]) => ({
                rate: parseFloat(rate),
                base: Math.round(data.base * 100) / 100,
                tax: Math.round(data.tax * 100) / 100,
                gross: Math.round(data.gross * 100) / 100,
                count: data.count,
            })),

            paymentBreakdown: paymentBreakdown.map(p => ({
                method: p._id,
                count: p.count,
                total: Math.round(p.total * 100) / 100,
            })),

            orderTypeBreakdown: orderTypeBreakdown.map(t => ({
                type: t._id,
                count: t.count,
                total: Math.round(t.total * 100) / 100,
            })),

            fiscal: {
                firstInvoice,
                lastInvoice,
                fiscalCount: fiscalData.length,
                confirmed: fiscalData.filter(f => f.status === "confirmed").length,
                failed: fiscalData.filter(f => f.status === "failed").length,
            },

            cashDrawer: {
                openingFloat: 0, // ročno vneseno ob odprtju blagajne
                cashSales: Math.round(cashTotal * 100) / 100,
                cashRefunds: 0, // TODO: implement refunds
                expectedInDrawer: Math.round(cashTotal * 100) / 100,
                countedInDrawer: null, // ročno vneseno ob zaključku
                difference: null,
            },

            orders: orders.map(o => ({
                orderId: o.orderId,
                time: format(new Date(o.createdAt), "HH:mm:ss"),
                customer: o.clientName,
                table: o.table?.name,
                type: o.type,
                paymentMethod: o.paymentMethod,
                total: o.totalAmount,
                serviceCharge: o.serviceCharge || 0,
                cashier: o.user?.name,
            })),
        };

        res.status(200).json({
            success: true,
            zReport,
        });
    } catch (error) {
        console.error("Z-Report error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/reports/x-report
 * X-Report — mid-day snapshot (ni zaključek, samo trenutno stanje).
 */
router.get("/x-report", requirePermission("reports:read"), async (req, res) => {
    try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();

        const matchStage = {
            createdAt: { $gte: startDate, $lte: endDate },
            status: "Completed",
        };

        const [summary, paymentBreakdown, hourlyData] = await Promise.all([
            Order.aggregate([
                { $match: matchStage },
                { $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: "$totalAmount" },
                    totalServiceCharge: { $sum: { $ifNull: ["$serviceCharge", 0] } },
                }},
            ]),
            Order.aggregate([
                { $match: matchStage },
                { $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 },
                    total: { $sum: "$totalAmount" },
                }},
            ]),
            Order.aggregate([
                { $match: matchStage },
                { $group: {
                    _id: { $hour: "$createdAt" },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" },
                }},
                { $sort: { _id: 1 } },
            ]),
        ]);

        const pending = await Order.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            status: "Pending",
        });

        const preparing = await Order.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            status: "Preparing",
        });

        res.status(200).json({
            success: true,
            xReport: {
                generatedAt: new Date().toISOString(),
                date: format(new Date(), "yyyy-MM-dd"),
                summary: summary[0] || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0, totalServiceCharge: 0 },
                paymentBreakdown,
                hourlyData,
                pending,
                preparing,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
