const mongoose = require("mongoose");
const Order = require("../models/order.model");
const { MenuItem } = require("../models/menu.model");
const Client = require("../models/client.model");
const FiscalInvoice = require("../models/fiscalInvoice.model");
const Outlet = require("../models/outlet.model");
const CurrencySettings = require("../models/currencySettings.model");
const ApiError = require("../utils/ApiError");
const { getIo } = require("../config/socket.config");
const { notifyNewOrderPush, notifyOrderReadyPush } = require("../utils/pushService");
const { awardPointsForOrder } = require("./loyalty.controller");
const { confirmInvoice } = require("../utils/furs");
const { logAction } = require("../middlewares/auditLog.middleware");

/**
 * Interni helper — sproži se, ko order preide v terminalno stanje "Completed".
 *
 * 1. Nagradi loyalty točke stranki (idempotentno — preveri loyaltyHistory,
 *    da preprečimo dvojno nagrajevanje).
 * 2. Izda fiskalni račun pri FURS (idempotentno — preveri obstoječi FiscalInvoice;
 *    confirmInvoice samodejno no-op, če FURS_ENABLED=false).
 *
 * Obe operaciji sta best-effort: nikoli ne smeta zlomiti glavnega toka plačila.
 * Vsi error-i se samo zlogirajo (non-blocking).
 */
const onOrderCompleted = async (order, user) => {
    // 1. Loyalty točke (samo enkrat na order)
    try {
        if (order.client) {
            const client = await Client.findById(order.client).select("loyaltyHistory");
            const alreadyAwarded = client?.loyaltyHistory?.some(
                (h) => h.type === "earned" && h.orderId && String(h.orderId) === String(order._id)
            );
            if (!alreadyAwarded) {
                await awardPointsForOrder(order);
            }
        }
    } catch (e) {
        console.error("Loyalty award error (non-blocking):", e.message);
    }

    // 2. Fiskalni račun (samo enkrat na order)
    try {
        const existing = await FiscalInvoice.findOne({ order: order._id });
        if (!existing) {
            // Pridobi outlet: prioritetno iz uporabnika, sicer primarni outlet.
            let outlet = null;
            if (user?.outletId) {
                outlet = await Outlet.findById(user.outletId);
            }
            if (!outlet) {
                outlet = await Outlet.getPrimary();
            }
            const method = (order.paymentMethod || "cash").toLowerCase();
            await confirmInvoice(order, outlet, method, user);
        }
    } catch (e) {
        console.error("Fiscal invoice error (non-blocking):", e.message);
    }
};

// ... (createOrder logic up to generating unique ID)
// Create a new order
const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { type, paymentMethod, items, clientId, tableId, clientName, clientPhone } = req.body;

        if (!items || items.length === 0) {
            throw new ApiError(400, "Order must contain at least one item.");
        }

        // 1. Find or Create Client
        let client;
        if (clientId) {
            client = await Client.findById(clientId).session(session);
        } else if (clientPhone) {
            client = await Client.findOne({ phone: clientPhone }).session(session);
            if (!client) {
                if (!clientName) {
                    throw new ApiError(400, "Client name is required for new customers.");
                }
                [client] = await Client.create([{
                    name: clientName,
                    phone: clientPhone,
                    totalSpent: 0,
                    orders: [],
                    lastVisit: new Date()
                }], { session });
            }
        } else {
            throw new ApiError(400, "Client phone number is required.");
        }

        if (!client) {
            throw new ApiError(404, "Client not found or could not be created.");
        }

        const finalClientId = client._id;

        // 2. Calculate total and validate items
        // Pridobi CurrencySettings za tax rate + taxInclusive flag (prej hardcoded
        // nič — totalAmount je bil bruto brez razčlenitve, FURS/zreport so morali
        // back-calculate z hardcoded 22%).
        const currencySettings = await CurrencySettings.getSettings();
        const taxRate = currencySettings.taxRates?.standard || 0;
        const taxInclusive = currencySettings.taxInclusive !== false; // default true

        let totalAmount = 0;
        const validItems = [];

        for (const item of items) {
            const menuItem = await MenuItem.findById(item.menuItem).session(session);
            if (!menuItem) {
                throw new ApiError(404, `Menu item not found: ${item.menuItem}`);
            }

            // Use current price from DB, not from frontend
            const basePrice = menuItem.price;
            let unitPrice = basePrice;

            // === Modifikatorji — upoštevaj priceAdjustment/priceOverride iz body-ja ===
            // (prejšnje stanje: modifikatorji ignorirani pri izračunu cene)
            const modifiers = [];
            if (Array.isArray(item.modifiers)) {
                for (const mod of item.modifiers) {
                    if (mod.priceOverride != null) {
                        unitPrice = mod.priceOverride;
                    } else {
                        unitPrice += mod.priceAdjustment || 0;
                    }
                    modifiers.push({
                        groupName: mod.groupName || "Modifier",
                        modifierName: mod.modifierName || "",
                        priceAdjustment: mod.priceAdjustment || 0,
                        priceOverride: mod.priceOverride ?? null,
                    });
                }
            }

            const lineTotal = unitPrice * item.quantity;
            totalAmount += lineTotal;

            validItems.push({
                menuItem: menuItem._id,
                name: menuItem.name,
                price: basePrice,
                unitPrice,
                lineTotal,
                quantity: item.quantity,
                modifiers,
                course: item.course || 1,
            });
        }

        // Zaokroži na 2 decimalki (denar)
        totalAmount = Math.round(totalAmount * 100) / 100;

        // === Davčna razčlenitev ===
        // Pri tax-inclusive (Slovenija/EUR): cene menija že vsebujejo DDV.
        //   subtotal (neto) = totalAmount / (1 + rate/100)
        //   taxAmount = totalAmount - subtotal
        // Pri tax-exclusive (npr. USD): cene so brez DDV.
        //   subtotal = totalAmount (vsota cen)
        //   taxAmount = subtotal * rate/100
        //   totalAmount (bruto) = subtotal + taxAmount
        let subtotal, taxAmount, grossTotal;
        if (taxInclusive) {
            subtotal = Math.round((totalAmount / (1 + taxRate / 100)) * 100) / 100;
            taxAmount = Math.round((totalAmount - subtotal) * 100) / 100;
            grossTotal = totalAmount;
        } else {
            subtotal = totalAmount;
            taxAmount = Math.round((subtotal * taxRate / 100) * 100) / 100;
            grossTotal = Math.round((subtotal + taxAmount) * 100) / 100;
        }

        // 3. Generate unique Order ID
        const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // 4. Create Order
        const newOrder = new Order({
            orderId,
            type,
            paymentMethod: paymentMethod || "Cash",
            items: validItems,
            totalAmount: grossTotal,
            subtotal,
            taxRate,
            taxAmount,
            // outletId iz osebja, ki oddaja naročilo (multi-outlet reporting)
            outletId: req.user.outletId || null,
            client: finalClientId,
            clientName: client.name,
            clientPhone: client.phone,
            user: req.user._id, // Assumes auth middleware populates req.user
            table: tableId || null
        });

        await newOrder.save({ session });

        // 5. Update Client History (uporabi bruto znesek)
        await Client.findByIdAndUpdate(finalClientId, {
            $push: { orders: newOrder._id },
            $inc: { totalSpent: grossTotal },
            $set: { lastVisit: new Date() }
        }, { session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // 6. Populate and return for billing slip
        const populatedOrder = await Order.findById(newOrder._id)
            .populate("client", "name email phone address")
            .populate("user", "name")
            .populate("table", "name zone");

        // Emit real-time event for new order
        try {
            const io = getIo();
            io.emit("newOrder", populatedOrder);
        } catch (socketError) {
            console.error("Socket.io error on newOrder:", socketError);
        }

        // Send push notification to kitchen/cashier
        notifyNewOrderPush(populatedOrder).catch(e => console.error("Push error:", e.message));

        // Audit log — order_create (non-blocking)
        logAction(req, {
            action: "order_create",
            entity: "order",
            entityId: newOrder._id,
            description: `Order ${orderId} created for ${client.name} (${grossTotal.toFixed(2)} ${currencySettings.code})`,
            changes: { before: null, after: { orderId, totalAmount: grossTotal, taxRate, taxAmount, outletId: newOrder.outletId } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: populatedOrder
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

// ... (getAllOrders, getOrderStats, getOrderById, getKitchenOrders remain unchanged)
const getAllOrders = async (req, res, next) => {
    try {
        const { type, status, startDate, endDate, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = {};

        if (type) query.type = type;
        if (status) query.status = status;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate("client", "name phone")
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            orders,
            pagination: {
                totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

const getOrderStats = async (req, res, next) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: "Pending" });

        // Revenue aggregate
        const revenueData = await Order.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
        ]);

        const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Recently placed orders for the table
        const recentOrders = await Order.find()
            .populate("client", "name")
            .populate("table", "name")
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            stats: {
                totalRevenue,
                totalOrders,
                pendingOrders,
                avgOrderValue
            },
            recentOrders
        });
    } catch (error) {
        next(error);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("client")
            .populate("user", "name")
            .populate("table", "name");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({ success: true, order });
    } catch (error) {
        next(error);
    }
};

const getKitchenOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({
            status: { $in: ["Pending", "Preparing", "Ready"] }
        })
            .populate("client", "name")
            .populate("table", "name")
            .populate("user", "name")
            .sort({ createdAt: 1 }); // Oldest first for kitchen

        res.status(200).json({ success: true, orders });
    } catch (error) {
        next(error);
    }
};


// Update order status
const updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        if (!["Pending", "Preparing", "Ready", "Completed", "Cancelled"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        ).populate("client", "name phone")
            .populate("user", "name")
            .populate("table", "name");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Emit real-time event for order status update
        try {
            const io = getIo();
            io.emit("orderStatusUpdate", order);
        } catch (socketError) {
            console.error("Socket.io error on orderStatusUpdate:", socketError);
        }

        // Send push notification when order is Ready
        if (status === "Ready") {
            notifyOrderReadyPush(order).catch(e => console.error("Push error:", e.message));
        }

        // Ko je order dokončan — nagradi loyalty točke + izdaj fiskalni račun (best-effort).
        if (status === "Completed") {
            onOrderCompleted(order, req.user).catch(e => console.error("onOrderCompleted error:", e.message));
        }

        // Audit log — order_status_update ali order_cancel (non-blocking)
        logAction(req, {
            action: status === "Cancelled" ? "order_cancel" : "order_status_update",
            entity: "order",
            entityId: order._id,
            description: `Order ${order.orderId} marked as ${status} by ${req.user?.name || "system"}`,
            changes: { before: { status: order.status }, after: { status } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({ success: true, message: `Order marked as ${status}`, order });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/orders/:id/payment
 * Doda plačilo k order-ju (split payments).
 *
 * Popravek (race condition): prejšnje stanje je bilo read-modify-write brez
 * zaklepanja — dva konkurenčna zahtevka (npr. dve blagajni istočasno) bi
 * lahko oba prebrala order z enakim amountPaid, oba pushala plačilo in
 * pri shranjevanju prepisala drug drugega → podvojena plačila / negativen
 * balanceDue. Sedaj uporabljamo Mongoose optimistic locking (document
 * versioning preko __v) + transakcijo, tako da drugi zahtevek dobi
 * VersionMismatch error in se odbije.
 */
const addPayment = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { method, amount, reference } = req.body;

        if (!["Cash", "Card", "Online"].includes(method)) {
            return res.status(400).json({ success: false, message: "Invalid payment method" });
        }
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
        }

        const order = await Order.findById(id).session(session);
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const currentPaid = (order.payments || []).reduce((sum, p) => sum + p.amount, 0);
        const remaining = order.totalAmount - currentPaid;

        if (amount > remaining + 0.01) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Payment exceeds remaining balance (€${remaining.toFixed(2)})`
            });
        }

        order.payments = order.payments || [];
        order.payments.push({
            method, amount: Math.round(amount * 100) / 100,
            reference: reference || null, timestamp: new Date()
        });

        order.amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
        order.balanceDue = Math.max(0, order.totalAmount - order.amountPaid);
        order.paymentMethod = order.payments.length > 1 ? "Split" : order.payments[0].method;

        if (order.balanceDue === 0 && order.status === "Pending") {
            order.status = "Completed";
        }

        // save() znotraj transakcije; če je dokument medtem spremenil drug zahtevek,
        // Mongoose sproži VersionError (optimistic locking preko __v).
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        const populatedOrder = await Order.findById(order._id)
            .populate("client", "name phone")
            .populate("user", "name")
            .populate("table", "name zone");

        try {
            const io = getIo();
            io.emit("paymentUpdate", populatedOrder);
            if (order.balanceDue === 0) io.emit("orderStatusUpdate", populatedOrder);
        } catch (e) { console.error("Socket error:", e); }

        // Ko je račun popolnoma plačan (in order samodejno prešel v Completed) —
        // nagradi loyalty točke + izdaj fiskalni račun (best-effort, non-blocking).
        if (order.balanceDue === 0) {
            onOrderCompleted(populatedOrder, req.user).catch(e => console.error("onOrderCompleted error:", e.message));
        }

        // Audit log — order_payment (non-blocking)
        logAction(req, {
            action: "order_payment",
            entity: "order",
            entityId: order._id,
            description: `Payment ${method} ${amount.toFixed(2)} for order ${order.orderId}${order.balanceDue === 0 ? " (fully paid)" : ` (${order.balanceDue.toFixed(2)} remaining)`}`,
            changes: { before: { amountPaid: order.amountPaid - amount }, after: { amountPaid: order.amountPaid, balanceDue: order.balanceDue } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({
            success: true,
            message: order.balanceDue === 0 ? "Payment complete — order Completed" : `€${order.balanceDue.toFixed(2)} remaining`,
            order: populatedOrder,
            balanceDue: order.balanceDue,
            isFullyPaid: order.balanceDue === 0
        });
    } catch (error) {
        try { await session.abortTransaction(); } catch { /* already ended */ }
        session.endSession();

        // Optimistic locking collision — drug zahtevek je medtem spremenil order.
        // Vrni 409 Conflict, da klient ve naj ponovno pridobi order in poskusi znova.
        if (error && error.name === "VersionError") {
            return res.status(409).json({
                success: false,
                message: "Order was modified by another transaction. Please refresh and retry.",
            });
        }
        next(error);
    }
};

/**
 * POST /api/orders/:id/send-course
 * Pošlje specifični course (predjed/glavna jed/desert) v kuhinjo.
 * Body: { course: 1 } — pošlje vse iteme s tem course-om, ki še niso poslani.
 */
const sendCourseToKitchen = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { course = 1 } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Označi iteme s tem course-om kot poslane
        let sentCount = 0;
        order.items.forEach(item => {
            if (item.course === course && !item.sentToKitchen) {
                item.sentToKitchen = true;
                sentCount++;
            }
        });

        if (sentCount === 0) {
            return res.status(400).json({
                success: false,
                message: `No unsent items found for course ${course}`
            });
        }

        await order.save();

        const populatedOrder = await Order.findById(order._id)
            .populate("client", "name phone")
            .populate("user", "name")
            .populate("table", "name zone");

        // Emit Socket.io — samo poslani itemi gredo v KDS
        try {
            const io = getIo();
            io.emit("courseSent", { order: populatedOrder, course, sentCount });
        } catch (socketError) {
            console.error("Socket.io error on courseSent:", socketError);
        }

        res.status(200).json({
            success: true,
            message: `Course ${course} sent to kitchen (${sentCount} items)`,
            order: populatedOrder,
            sentCount,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createOrder, getAllOrders, getOrderById, getOrderStats, updateOrderStatus, getKitchenOrders, sendCourseToKitchen, addPayment };
