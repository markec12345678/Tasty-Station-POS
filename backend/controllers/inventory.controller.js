const Inventory = require("../models/inventory.model");
const { logAction } = require("../middlewares/auditLog.middleware");
const { sendToRole } = require("../utils/pushService");

/**
 * Interni helper — preveri ali item po update-u pade pod reorderLevel.
 * Če da, pošlje push notification admin/manager vlogam (best-effort).
 *
 * Prejšnje stanje: notifyLowStock helper je obstajal v notifications.js
 * (frontend) a bil dead code. Backend sploh ni obveščal o nizki zalogi.
 *
 * @param {Object} item — Inventory dokument (po update-u)
 */
const checkLowStockAndNotify = async (item) => {
    try {
        if (!item || !item.reorderLevel) return;
        if (item.quantity <= item.reorderLevel) {
            // Push notification admin/manager vlogam (best-effort, non-blocking).
            // Uporabimo sendToRole iz pushService — deluje samo če imajo uporabniki
            // registriran Expo push token (mobile app).
            await sendToRole(
                ["admin", "manager"],
                "⚠️ Nizka zaloga!",
                `${item.name} — ${item.quantity} ${item.unit} (reorder at ${item.reorderLevel})`,
                { type: "lowStock", itemId: item._id?.toString?.() || item._id, name: item.name },
                { channelId: "inventory", sound: true, priority: "high", badge: 1 }
            );
        }
    } catch (e) {
        console.error("Low stock notification error (non-blocking):", e.message);
    }
};

// Add new stock item
const addStockItem = async (req, res) => {
    try {
        const { name, category, quantity, unit, reorderLevel, supplier, costPerUnit } = req.body;

        const newItem = new Inventory({
            name,
            category,
            quantity,
            unit,
            reorderLevel,
            supplier,
            costPerUnit
        });

        await newItem.save();

        // Če je nov item že pod reorder level, obvesti admin/manager (best-effort).
        checkLowStockAndNotify(newItem).catch(e => console.error("Low stock check error:", e.message));

        // Audit log — inventory:create (non-blocking)
        logAction(req, {
            action: "inventory_create",
            entity: "inventory",
            entityId: newItem._id,
            description: `Inventory item ${newItem.name} created by ${req.user?.email} (qty: ${newItem.quantity} ${newItem.unit})`,
            changes: { before: null, after: { name: newItem.name, quantity: newItem.quantity, reorderLevel: newItem.reorderLevel } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(201).json({ success: true, data: newItem });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Get all inventory items
const getInventory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalItems = await Inventory.countDocuments();
        const items = await Inventory.find()
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: items,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update stock quantity or details
const updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (updateData.quantity !== undefined) {
            updateData.lastRestocked = Date.now();
        }

        const updatedItem = await Inventory.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        if (!updatedItem) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // Preveri low stock po update-u (best-effort, non-blocking).
        checkLowStockAndNotify(updatedItem).catch(e => console.error("Low stock check error:", e.message));

        // Audit log — inventory:update (non-blocking)
        logAction(req, {
            action: "inventory_update",
            entity: "inventory",
            entityId: updatedItem._id,
            description: `Inventory ${updatedItem.name} updated by ${req.user?.email} (qty: ${updatedItem.quantity} ${updatedItem.unit})`,
            changes: { after: { name: updatedItem.name, quantity: updatedItem.quantity, reorderLevel: updatedItem.reorderLevel } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({ success: true, data: updatedItem });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Delete stock item
const deleteStockItem = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedItem = await Inventory.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // Audit log — inventory:delete (non-blocking)
        logAction(req, {
            action: "inventory_delete",
            entity: "inventory",
            entityId: id,
            description: `Inventory item ${deletedItem.name} deleted by ${req.user?.email}`,
            changes: { before: { name: deletedItem.name, quantity: deletedItem.quantity }, after: null },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({ success: true, message: "Item deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get stock reports
const getStockReports = async (req, res) => {
    try {
        const allItems = await Inventory.find();

        const lowStockItems = allItems.filter(item => item.quantity <= item.reorderLevel);
        const totalValue = allItems.reduce((acc, item) => acc + (item.quantity * (item.costPerUnit || 0)), 0);

        const stats = {
            totalItems: allItems.length,
            lowStockCount: lowStockItems.length,
            totalValue,
            lowStockItems
        };

        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    addStockItem,
    getInventory,
    updateStock,
    deleteStockItem,
    getStockReports
};
