/**
 * Push notification service — pošiljanje push notifications preko Expo Push API.
 *
 * Expo Push API: https://exp.host/--/api/v2/push/send
 * Brezplačno za development, omejeno za produkcijo (1000 req/min).
 *
 * Za produkcijo z veliko uporabniki: uporabi FCM direktno ali Firebase Admin SDK.
 */

const axios = require("axios");
const User = require("../models/user.model");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Pošlje push notification na enega ali več naprav.
 *
 * @param {String|String[]} tokens — Expo push token(s)
 * @param {String} title — naslov
 * @param {String} body — vsebina
 * @param {Object} data — dodatni podatki (JSON)
 * @param {Object} options — { sound, badge, channelId, priority }
 * @returns {Object} { success, tickets }
 */
const sendPushNotification = async (tokens, title, body, data = {}, options = {}) => {
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    const validTokens = tokenArray.filter(t => t && t.startsWith("ExponentPushToken"));

    if (validTokens.length === 0) {
        return { success: false, error: "No valid Expo push tokens" };
    }

    try {
        const messages = validTokens.map(token => ({
            to: token,
            title,
            body,
            data: data || {},
            sound: options.sound !== false ? "default" : null,
            badge: options.badge || 0,
            channelId: options.channelId || "default",
            priority: options.priority || "high",
            _displayInForeground: true,
        }));

        const response = await axios.post(EXPO_PUSH_URL, messages, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout: 10000,
        });

        const tickets = response.data?.data || [];
        const successes = tickets.filter(t => t.status === "ok");
        const failures = tickets.filter(t => t.status === "error");

        if (failures.length > 0) {
            console.warn(`[Push] ${failures.length} failed:`, failures.map(f => f.message));
        }

        return {
            success: successes.length > 0,
            sent: successes.length,
            failed: failures.length,
            tickets,
        };
    } catch (error) {
        console.error("[Push] Send error:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Pošlje push notification vsem aktivnim uporabnikom z določeno vlogo.
 *
 * @param {String|String[]} roles — vloga(e) npr. "kitchen" ali ["cashier", "waiter"]
 * @param {String} title
 * @param {String} body
 * @param {Object} data
 * @param {Object} options
 */
const sendToRole = async (roles, title, body, data = {}, options = {}) => {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    const users = await User.find({
        role: { $in: roleArray },
        isActive: true,
        pushToken: { $ne: null, $exists: true },
    }).select("pushToken");

    const tokens = users.map(u => u.pushToken).filter(Boolean);

    if (tokens.length === 0) {
        return { success: false, error: "No users with push tokens for these roles" };
    }

    return await sendPushNotification(tokens, title, body, data, options);
};

/**
 * Pošlje push notification specifičnemu uporabniku.
 *
 * @param {String} userId — ObjectId uporabnika
 * @param {String} title
 * @param {String} body
 * @param {Object} data
 */
const sendToUser = async (userId, title, body, data = {}, options = {}) => {
    const user = await User.findById(userId).select("pushToken");
    if (!user || !user.pushToken) {
        return { success: false, error: "User has no push token" };
    }
    return await sendPushNotification(user.pushToken, title, body, data, options);
};

// === Preddefinirana obvestila ===

const notifyNewOrderPush = async (order) => {
    return await sendToRole(["kitchen", "cashier"], "🍽️ Novo naročilo!", 
        `${order.clientName || "Guest"} • ${order.items?.length || 0} artiklov • €${(order.totalAmount || 0).toFixed(2)}`,
        { type: "newOrder", orderId: order._id },
        { channelId: "orders", sound: true, priority: "high", badge: 1 }
    );
};

const notifyOrderReadyPush = async (order) => {
    // Poišči natakarja ki je ustvaril naročilo
    if (order.user) {
        return await sendToUser(order.user, "✅ Naročilo pripravljeno!",
            `Miza ${order.table?.name || "?"} • ${order.orderId}`,
            { type: "orderReady", orderId: order._id },
            { channelId: "orders", sound: true, badge: 1 }
        );
    }
    return await sendToRole(["waiter", "cashier"], "✅ Naročilo pripravljeno!",
        `${order.orderId} • Prevzemi pri kuhinji`,
        { type: "orderReady", orderId: order._id },
        { channelId: "orders", sound: true, badge: 1 }
    );
};

const notifyQROrderPush = async (orderData) => {
    return await sendToRole(["kitchen", "cashier"], "📱 QR naročilo od gosta!",
        `Miza ${orderData.tableName || "?"} • ${orderData.customerName} • €${(orderData.totalAmount || 0).toFixed(2)}`,
        { type: "qrOrder", orderId: orderData.orderId },
        { channelId: "orders", sound: true, priority: "high", badge: 1 }
    );
};

module.exports = {
    sendPushNotification,
    sendToRole,
    sendToUser,
    notifyNewOrderPush,
    notifyOrderReadyPush,
    notifyQROrderPush,
};
