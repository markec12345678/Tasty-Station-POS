const express = require("express");
const router = express.Router();
const StockMovement = require("../models/stockMovement.model");
const Inventory = require("../models/inventory.model");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");

// Vsi stock movement route-i zahtevajo avtentikacijo + inventory:read
router.use(protectedRoute);
router.use(requirePermission("inventory:read"));

/**
 * GET /api/stock-movements
 * Vrne seznam stock gibanj z filtri in paginacijo.
 *
 * Query parametri:
 *   - inventory: filter po specifičnem inventory item-u
 *   - type: filter po tipu (order, restock, waste, adjustment, transfer, return)
 *   - order: filter po specifičnem order-ju
 *   - outlet: filter po outlet-u
 *   - startDate / endDate: datumski range
 *   - page / limit: paginacija (default 1/50)
 */
router.get("/", async (req, res, next) => {
    try {
        const {
            inventory, type, order, outlet,
            startDate, endDate,
            page = 1, limit = 50,
        } = req.query;

        const filter = {};
        if (inventory) filter.inventory = inventory;
        if (type) filter.type = type;
        if (order) filter.order = order;
        if (outlet) filter.outlet = outlet;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await StockMovement.countDocuments(filter);
        const movements = await StockMovement.find(filter)
            .populate("inventory", "name unit category")
            .populate("order", "orderId")
            .populate("menuItem", "name")
            .populate("outlet", "name code")
            .populate("user", "name role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: movements.length,
            movements,
            pagination: {
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/stock-movements/stats
 * Vrne agregirano statistiko gibanj za dashboard.
 *
 * Query: startDate, endDate (default: zadnjih 30 dni)
 */
router.get("/stats", async (req, res, next) => {
    try {
        const startDate = req.query.startDate
            ? new Date(req.query.startDate)
            : new Date(Date.now() - 30 * 86400000);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        endDate.setHours(23, 59, 59, 999);

        // Agregacija po tipu gibanja
        const byType = await StockMovement.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    totalQuantity: { $sum: "$quantityChange" },
                    totalValue: { $sum: "$totalValue" },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Top 5 najbolj porabljenih inventory item-ov
        const topConsumed = await StockMovement.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    quantityChange: { $lt: 0 }, // samo poraba (negativne)
                },
            },
            {
                $group: {
                    _id: "$inventory",
                    name: { $first: "$inventoryName" },
                    totalConsumed: { $sum: { $abs: "$quantityChange" } },
                    totalValue: { $sum: "$totalValue" },
                    movementCount: { $sum: 1 },
                },
            },
            { $sort: { totalConsumed: -1 } },
            { $limit: 5 },
        ]);

        // Skupna poraba in vrednost
        const totals = await StockMovement.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    quantityChange: { $lt: 0 },
                },
            },
            {
                $group: {
                    _id: null,
                    totalConsumedValue: { $sum: "$totalValue" },
                    totalMovements: { $sum: 1 },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            stats: {
                period: { startDate, endDate },
                byType,
                topConsumed,
                totals: totals[0] || { totalConsumedValue: 0, totalMovements: 0 },
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/stock-movements/inventory/:id
 * Vrne celotno zgodovino gibanj za specifičen inventory item.
 * Uporabno za "stock card" pogled v inventory management.
 */
router.get("/inventory/:id", async (req, res, next) => {
    try {
        const movements = await StockMovement.find({ inventory: req.params.id })
            .populate("order", "orderId")
            .populate("menuItem", "name")
            .populate("user", "name role")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: movements.length,
            movements,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/stock-movements/restock
 * Ročno dopolnitev zaloge (od dobavitelja).
 * Body: { inventory, quantity, reason?, costPerUnit? }
 *
 * Uporablja se ko admin vnese novo dobavo. Posodobi inventory.quantity in
 * zabeleži StockMovement z type="restock".
 */
router.post("/restock", requirePermission("inventory:update"), async (req, res, next) => {
    try {
        const { inventory: inventoryId, quantity, reason, costPerUnit } = req.body;

        if (!inventoryId) return res.status(400).json({ success: false, message: "Inventory ID required" });
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: "Quantity must be > 0" });
        }

        const inv = await Inventory.findById(inventoryId);
        if (!inv) return res.status(404).json({ success: false, message: "Inventory item not found" });

        const quantityBefore = inv.quantity;
        const quantityAfter = quantityBefore + quantity;

        // Posodobi zalogo + lastRestocked + opcijsko costPerUnit
        const update = {
            quantity: quantityAfter,
            lastRestocked: new Date(),
        };
        if (costPerUnit != null && costPerUnit >= 0) {
            update.costPerUnit = costPerUnit;
        }
        await Inventory.findByIdAndUpdate(inventoryId, update);

        const movement = await StockMovement.create({
            inventory: inv._id,
            inventoryName: inv.name,
            type: "restock",
            quantityChange: quantity, // pozitivno
            quantityBefore,
            quantityAfter,
            unit: inv.unit,
            outlet: req.user?.outletId || null,
            user: req.user?._id || null,
            userName: req.user?.name || null,
            reason: reason || "Manual restock",
            costPerUnit: costPerUnit != null ? costPerUnit : (inv.costPerUnit || 0),
            totalValue: Math.round(quantity * (costPerUnit != null ? costPerUnit : (inv.costPerUnit || 0)) * 100) / 100,
        });

        res.status(201).json({
            success: true,
            message: `Restocked ${quantity} ${inv.unit} of ${inv.name}`,
            movement,
            inventory: { ...inv.toObject(), quantity: quantityAfter },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/stock-movements/adjust
 * Ročna korekcija zaloge (inventario, popravki).
 * Body: { inventory, newQuantity, reason }
 *
 * Razlika med trenutno in novo količino se zabeleži kot type="adjustment".
 */
router.post("/adjust", requirePermission("inventory:update"), async (req, res, next) => {
    try {
        const { inventory: inventoryId, newQuantity, reason } = req.body;

        if (!inventoryId) return res.status(400).json({ success: false, message: "Inventory ID required" });
        if (newQuantity == null || newQuantity < 0) {
            return res.status(400).json({ success: false, message: "newQuantity must be >= 0" });
        }
        if (!reason || reason.trim().length < 3) {
            return res.status(400).json({ success: false, message: "Reason is required (min 3 chars)" });
        }

        const inv = await Inventory.findById(inventoryId);
        if (!inv) return res.status(404).json({ success: false, message: "Inventory item not found" });

        const quantityBefore = inv.quantity;
        const quantityAfter = newQuantity;
        const change = quantityAfter - quantityBefore;

        await Inventory.findByIdAndUpdate(inventoryId, { quantity: quantityAfter });

        const movement = await StockMovement.create({
            inventory: inv._id,
            inventoryName: inv.name,
            type: "adjustment",
            quantityChange: change, // lahko + ali -
            quantityBefore,
            quantityAfter,
            unit: inv.unit,
            outlet: req.user?.outletId || null,
            user: req.user?._id || null,
            userName: req.user?.name || null,
            reason,
            costPerUnit: inv.costPerUnit || 0,
            totalValue: Math.round(Math.abs(change) * (inv.costPerUnit || 0) * 100) / 100,
        });

        res.status(201).json({
            success: true,
            message: `Adjusted ${inv.name}: ${quantityBefore} → ${quantityAfter} ${inv.unit}`,
            movement,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
