const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { MenuItem, Category } = require("../models/menu.model");
const Table = require("../models/table.model");
const Order = require("../models/order.model");
const Client = require("../models/client.model");
const { getIo } = require("../config/socket.config");

// === JAVNI ENDPOINTI (brez avtentikacije) ===
// Uporablja se za QR kodno naročanje gostov.

/**
 * GET /api/public/menu
 * Vrne aktiven meni z kategorijami (javno).
 */
router.get("/menu", async (req, res) => {
    try {
        const [categories, menuItems] = await Promise.all([
            Category.find({ status: "active" }).sort("name").lean(),
            MenuItem.find({ isAvailable: true })
                .populate("category", "name")
                .select("name description price image isVeg spiceLevel preparationTime category variants")
                .lean(),
        ]);

        // Grupiraj po kategorijah
        const menuByCategory = categories.map(cat => ({
            ...cat,
            items: menuItems.filter(item =>
                item.category && item.category._id.toString() === cat._id.toString()
            ),
        })).filter(cat => cat.items.length > 0);

        res.status(200).json({
            success: true,
            categories,
            menuItems,
            menuByCategory,
        });
    } catch (error) {
        console.error("Public menu error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/public/table/:id
 * Vrne informacije o mizi (ime, zona, kapaciteta, status).
 */
router.get("/table/:id", async (req, res) => {
    try {
        const table = await Table.findById(req.params.id)
            .select("name zone capacity status")
            .lean();
        if (!table) {
            return res.status(404).json({ success: false, message: "Table not found" });
        }
        res.status(200).json({ success: true, table });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/public/tables
 * Vrne vse mize (za QR kodni pregled / admin display).
 */
router.get("/tables", async (req, res) => {
    try {
        const tables = await Table.find()
            .select("name zone capacity status")
            .sort("zone name")
            .lean();
        res.status(200).json({ success: true, tables });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/public/order
 * Gost odda naročilo preko QR kode (brez login-a).
 *
 * Body:
 *   tableId: String (required)
 *   customerName: String (optional, default "Guest")
 *   customerPhone: String (optional)
 *   items: [{ menuItemId, quantity, note? }] (required, min 1)
 *
 * Logic:
 *   1. Validiraj mizo in artikle
 *   2. Pridobi cene iz DB (ne zaupaj frontend-u)
 *   3. Najdi/ustvari Client (po telefonu če podan, sicer "Guest")
 *   4. Kreiraj Order s status "Pending" in type "Dine-in"
 *   5. Emit Socket.io "newOrder" za KDS
 */
router.post("/order", async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { tableId, customerName, customerPhone, items } = req.body;

        // Validacija
        if (!tableId) {
            return res.status(400).json({ success: false, message: "Table ID is required" });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "At least one item is required" });
        }

        // Preveri mizo
        const table = await Table.findById(tableId).session(session);
        if (!table) {
            return res.status(404).json({ success: false, message: "Table not found" });
        }

        // Pridobi artikle iz baze (z pravimi cenami)
        const menuItemIds = items.map(i => i.menuItemId);
        const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } }).session(session);

        if (menuItems.length !== menuItemIds.length) {
            return res.status(400).json({ success: false, message: "Some menu items not found" });
        }

        // Zgradi order items
        let totalAmount = 0;
        const orderItems = items.map(item => {
            const menuItem = menuItems.find(mi => mi._id.toString() === item.menuItemId);
            if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
            if (!menuItem.isAvailable) throw new Error(`${menuItem.name} is not available`);

            const qty = parseInt(item.quantity);
            if (qty < 1 || qty > 99) throw new Error(`Invalid quantity for ${menuItem.name}`);

            const itemTotal = menuItem.price * qty;
            totalAmount += itemTotal;

            return {
                menuItem: menuItem._id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: qty,
            };
        });

        // Najdi ali ustvari Client
        let client;
        const name = customerName?.trim() || "Guest";
        const phone = customerPhone?.trim();

        if (phone) {
            client = await Client.findOne({ phone }).session(session);
            if (!client) {
                [client] = await Client.create([{
                    name,
                    phone,
                    totalSpent: 0,
                    orders: [],
                    lastVisit: new Date(),
                }], { session });
            }
        } else {
            // Anonimni guest — uporabimo sistemski "Walk-in" client če obstaja, screariramo
            [client] = await Client.create([{
                name,
                phone: phone || `walkin-${table._id}-${Date.now()}`,
                totalSpent: 0,
                orders: [],
                lastVisit: new Date(),
            }], { session });
        }

        // Generiraj orderId
        const orderId = `QR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Kreiraj Order
        const newOrder = new Order({
            orderId,
            type: "Dine-in",
            status: "Pending",
            paymentMethod: "Cash", // gost še plača kasneje
            items: orderItems,
            totalAmount,
            client: client._id,
            clientName: name,
            clientPhone: phone || "",
            table: tableId,
            // user je null — QR order, ne zazna specificnega osebja
        });

        await newOrder.save({ session });

        // Update Client history
        await Client.findByIdAndUpdate(client._id, {
            $push: { orders: newOrder._id },
            $inc: { totalSpent: totalAmount },
            $set: { lastVisit: new Date() },
        }, { session });

        await session.commitTransaction();
        session.endSession();

        // Populate za emit
        const populatedOrder = await Order.findById(newOrder._id)
            .populate("client", "name phone")
            .populate("table", "name zone");

        // Emit real-time event za KDS in POS
        try {
            const io = getIo();
            io.emit("newOrder", populatedOrder);
            io.emit("qrOrderPlaced", {
                orderId: newOrder.orderId,
                tableId,
                tableName: populatedOrder.table?.name,
                customerName: name,
                totalAmount,
                itemCount: orderItems.length,
            });
        } catch (socketError) {
            console.error("Socket.io error on QR order:", socketError);
        }

        res.status(201).json({
            success: true,
            message: "Order placed successfully! Sprejeli smo vaše naročilo.",
            order: {
                orderId: newOrder.orderId,
                totalAmount,
                itemCount: orderItems.length,
                items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                table: populatedOrder.table?.name,
                status: "Pending",
            },
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("QR order error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to place order",
        });
    }
});

module.exports = router;
