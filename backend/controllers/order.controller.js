const mongoose = require("mongoose");
const Order = require("../models/order.model");
const { MenuItem } = require("../models/menu.model");
const Client = require("../models/client.model");
const ApiError = require("../utils/ApiError");
const { getIo } = require("../config/socket.config");

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
        let totalAmount = 0;
        const validItems = [];

        for (const item of items) {
            const menuItem = await MenuItem.findById(item.menuItem).session(session);
            if (!menuItem) {
                throw new ApiError(404, `Menu item not found: ${item.menuItem}`);
            }

            // Use current price from DB, not from frontend
            const price = menuItem.price;
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;

            validItems.push({
                menuItem: menuItem._id,
                name: menuItem.name,
                price: price,
                quantity: item.quantity
            });
        }

        // 3. Generate unique Order ID
        const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // 4. Create Order
        const newOrder = new Order({
            orderId,
            type,
            paymentMethod: paymentMethod || "Cash",
            items: validItems,
            totalAmount,
            client: finalClientId,
            clientName: client.name,
            clientPhone: client.phone,
            user: req.user._id, // Assumes auth middleware populates req.user
            table: tableId || null
        });

        await newOrder.save({ session });

        // 5. Update Client History
        await Client.findByIdAndUpdate(finalClientId, {
            $push: { orders: newOrder._id },
            $inc: { totalSpent: totalAmount },
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

        res.status(200).json({ success: true, message: `Order marked as ${status}`, order });
    } catch (error) {
        next(error);
    }
};

module.exports = { createOrder, getAllOrders, getOrderById, getOrderStats, updateOrderStatus, getKitchenOrders };
