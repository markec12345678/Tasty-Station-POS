const Order = require("../models/order.model");

// Helper to get date range — podpira tudi custom startDate/endDate
const getDateRange = (filter, customStart, customEnd) => {
    const now = new Date();
    let startDate, endDate;

    if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
        return { startDate, endDate };
    }

    switch (filter) {
        case "daily":
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case "weekly": {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            startDate = new Date(now);
            startDate.setDate(diff);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
        case "monthly":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case "yearly":
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        default:
            startDate = new Date(0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
    }
    return { startDate, endDate };
};

// 1. Sales Reports (Daily/Weekly/Monthly Trends) — podpira custom startDate/endDate
exports.getSalesReports = async (req, res) => {
    try {
        const { filter = "daily", startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);

        let groupBy;
        if (filter === "daily") {
            groupBy = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" } };
        } else if (filter === "weekly" || filter === "monthly") {
            groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else {
            groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        }

        const sales = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: "Completed" } },
            {
                $group: {
                    _id: groupBy,
                    totalSales: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: sales,
            period: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), filter }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Cashier-wise Collection — podpira custom date range
exports.getCashierCollections = async (req, res) => {
    try {
        const { filter = "daily", startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);

        const collections = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: "Completed" } },
            {
                $group: {
                    _id: "$user",
                    totalCollected: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "cashier"
                }
            },
            { $unwind: "$cashier" },
            {
                $project: {
                    _id: 1,
                    totalCollected: 1,
                    orderCount: 1,
                    cashierName: "$cashier.name",
                    cashierEmail: "$cashier.email"
                }
            },
            { $sort: { totalCollected: -1 } }
        ]);

        res.status(200).json({ success: true, data: collections });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Top Selling Items — podpira custom date range
exports.getTopSellingItems = async (req, res) => {
    try {
        const { filter = "daily", limit = 10, startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);

        const topItems = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: "Completed" } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.menuItem",
                    name: { $first: "$items.name" },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.status(200).json({ success: true, data: topItems });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Profit & Loss Statements — podpira custom date range
exports.getProfitLoss = async (req, res) => {
    try {
        const { filter = "monthly", startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);

        const report = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: "Completed" } },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "menuitems",
                    localField: "items.menuItem",
                    foreignField: "_id",
                    as: "menuDetails"
                }
            },
            { $unwind: "$menuDetails" },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    totalCost: { $sum: { $multiply: [{ $ifNull: ["$menuDetails.costPrice", 0] }, "$items.quantity"] } },
                    totalOrders: { $addToSet: "$_id" }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalRevenue: 1,
                    totalCost: 1,
                    profit: { $subtract: ["$totalRevenue", "$totalCost"] },
                    orderCount: { $size: "$totalOrders" }
                }
            }
        ]);

        res.status(200).json({ success: true, data: report[0] || { totalRevenue: 0, totalCost: 0, profit: 0, orderCount: 0 } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Comprehensive Dashboard — združi vse reporte v enem klicu (za admin dashboard)
// Query: filter (daily/weekly/monthly/yearly) ali custom startDate/endDate
exports.getDashboard = async (req, res) => {
    try {
        const { filter = "monthly", startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);

        const matchStage = {
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: "Cancelled" }
        };

        // Vzporedno poženi vse agregacije
        const [
            salesTrend,
            cashierCollections,
            topItems,
            profitLoss,
            orderStatusBreakdown,
            paymentMethodBreakdown,
            hourlyDistribution,
            summary
        ] = await Promise.all([
            // 1. Sales trend (časovna vrsta)
            Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: filter === "daily"
                            ? { $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" } }
                            : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        revenue: { $sum: "$totalAmount" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // 2. Cashier collections
            Order.aggregate([
                { $match: { ...matchStage, status: "Completed" } },
                { $group: { _id: "$user", totalCollected: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
                { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "cashier" } },
                { $unwind: "$cashier" },
                { $project: { _id: 1, totalCollected: 1, orderCount: 1, cashierName: "$cashier.name", cashierEmail: "$cashier.email" } },
                { $sort: { totalCollected: -1 } },
                { $limit: 10 }
            ]),

            // 3. Top 10 selling items
            Order.aggregate([
                { $match: { ...matchStage, status: "Completed" } },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.menuItem",
                        name: { $first: "$items.name" },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                    }
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: 10 }
            ]),

            // 4. Profit & Loss
            Order.aggregate([
                { $match: { ...matchStage, status: "Completed" } },
                { $unwind: "$items" },
                { $lookup: { from: "menuitems", localField: "items.menuItem", foreignField: "_id", as: "menuDetails" } },
                { $unwind: "$menuDetails" },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                        totalCost: { $sum: { $multiply: [{ $ifNull: ["$menuDetails.costPrice", 0] }, "$items.quantity"] } },
                        totalOrders: { $addToSet: "$_id" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalRevenue: 1,
                        totalCost: 1,
                        profit: { $subtract: ["$totalRevenue", "$totalCost"] },
                        margin: { $multiply: [{ $divide: [{ $subtract: ["$totalRevenue", "$totalCost"] }, "$totalRevenue"] }, 100] },
                        orderCount: { $size: "$totalOrders" }
                    }
                }
            ]),

            // 5. Order status breakdown
            Order.aggregate([
                { $match: matchStage },
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),

            // 6. Payment method breakdown
            Order.aggregate([
                { $match: { ...matchStage, status: "Completed" } },
                { $group: { _id: "$paymentMethod", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
                { $sort: { totalAmount: -1 } }
            ]),

            // 7. Hourly distribution (kdaj so vrhunski časi)
            Order.aggregate([
                { $match: matchStage },
                { $group: { _id: { $hour: "$createdAt" }, orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
                { $sort: { _id: 1 } }
            ]),

            // 8. Summary KPI-ji
            Order.aggregate([
                { $match: { ...matchStage, status: "Completed" } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$totalAmount" },
                        totalOrders: { $sum: 1 },
                        avgOrderValue: { $avg: "$totalAmount" },
                        uniqueClients: { $addToSet: "$client" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalRevenue: 1,
                        totalOrders: 1,
                        avgOrderValue: { $round: ["$avgOrderValue", 2] },
                        uniqueClients: { $size: "$uniqueClients" }
                    }
                }
            ])
        ]);

        res.status(200).json({
            success: true,
            dashboard: {
                summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, uniqueClients: 0 },
                profitLoss: profitLoss[0] || { totalRevenue: 0, totalCost: 0, profit: 0, margin: 0, orderCount: 0 },
                salesTrend,
                cashierCollections,
                topItems,
                orderStatusBreakdown,
                paymentMethodBreakdown,
                hourlyDistribution,
            },
            period: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                filter
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Category performance — poraba po kategorijah menija
exports.getCategoryPerformance = async (req, res) => {
    try {
        const { filter = "monthly", startDate: customStart, endDate: customEnd } = req.query;
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);

        const performance = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: "Completed" } },
            { $unwind: "$items" },
            { $lookup: { from: "menuitems", localField: "items.menuItem", foreignField: "_id", as: "menu" } },
            { $unwind: "$menu" },
            { $lookup: { from: "categories", localField: "menu.category", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$category._id",
                    categoryName: { $first: "$category.name" },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: performance,
            period: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), filter }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
