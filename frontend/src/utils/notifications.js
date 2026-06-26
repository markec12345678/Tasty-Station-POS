/**
 * Push notification service — browser push notifications za POS/KDS.
 *
 * Uporablja Notification Web API (browser native).
 * Za mobilne naprave (PWA) je potrebna Push API + Service Worker.
 *
 * Delovanje:
 *   1. Uporabnik dovoli obvestila (Notification.requestPermission)
 *   2. Kdorkoli kliče notify() — prikaže se desktop notification
 *   3. KDS/POS lahko klica notifyNewOrder(), notifyOrderReady(), itd.
 */

const PERMISSION_GRANTED = "granted";
const PERMISSION_DENIED = "denied";
const PERMISSION_DEFAULT = "default";

const isSupported = () => typeof window !== "undefined" && "Notification" in window;

const getPermission = () => {
    if (!isSupported()) return PERMISSION_DENIED;
    return Notification.permission;
};

const requestPermission = async () => {
    if (!isSupported()) return false;
    if (Notification.permission === PERMISSION_GRANTED) return true;
    if (Notification.permission === PERMISSION_DENIED) return false;
    try {
        const permission = await Notification.requestPermission();
        return permission === PERMISSION_GRANTED;
    } catch (error) {
        console.error("Notification permission error:", error);
        return false;
    }
};

const notify = (title, options = {}) => {
    if (!isSupported() || Notification.permission !== PERMISSION_GRANTED) return null;
    try {
        const notification = new Notification(title, {
            body: options.body || "",
            icon: options.icon || "/favicon.ico",
            badge: options.badge || "/favicon.ico",
            tag: options.tag || "tasty-station",
            data: options.data || {},
            requireInteraction: options.requireInteraction || false,
            silent: options.silent || false,
            ...options,
        });
        if (!options.requireInteraction) setTimeout(() => notification.close(), 10000);
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            notification.close();
            if (options.onClick) options.onClick(event);
        };
        return notification;
    } catch (error) {
        console.error("Notification error:", error);
        return null;
    }
};

const notifyNewOrder = (order) => {
    const itemCount = order.items?.length || 0;
    const customerName = order.clientName || "Guest";
    const table = order.table?.name || "—";
    return notify("🍽️ Novo naročilo!", {
        body: `${customerName} • Miza ${table} • ${itemCount} artiklov • €${(order.totalAmount || 0).toFixed(2)}`,
        tag: `new-order-${order._id}`,
        requireInteraction: false,
        silent: false,
        data: { orderId: order._id, type: "newOrder" },
        onClick: () => { window.location.href = "/kitchen"; },
    });
};

const notifyOrderReady = (order) => {
    const table = order.table?.name || "—";
    return notify("✅ Naročilo pripravljeno!", {
        body: `Miza ${table} • ${order.orderId} • Prevzemi pri kuhinji`,
        tag: `order-ready-${order._id}`,
        requireInteraction: true,
        silent: false,
        data: { orderId: order._id, type: "orderReady" },
        onClick: () => { window.location.href = "/orders"; },
    });
};

const notifyQROrder = (data) => {
    return notify("📱 QR naročilo od gosta!", {
        body: `${data.customerName || "Guest"} • Miza ${data.tableName || "—"} • ${data.itemCount} artiklov • €${(data.totalAmount || 0).toFixed(2)}`,
        tag: `qr-order-${data.orderId || Date.now()}`,
        requireInteraction: false,
        silent: false,
        data: { type: "qrOrder", ...data },
        onClick: () => { window.location.href = "/kitchen"; },
    });
};

const notifyPayment = (order) => {
    return notify("💰 Plačilo prejeto!", {
        body: `${order.orderId} • €${(order.totalAmount || 0).toFixed(2)} • ${order.paymentMethod || "Cash"}`,
        tag: `payment-${order._id}`,
        requireInteraction: false,
        silent: true,
        data: { orderId: order._id, type: "payment" },
    });
};

const notifyLowStock = (item) => {
    return notify("⚠️ Nizka zaloga!", {
        body: `${item.name} — ${item.currentStock} ${item.unit} (reorder at ${item.reorderLevel})`,
        tag: `low-stock-${item._id || item.name}`,
        requireInteraction: true,
        silent: false,
        data: { type: "lowStock", itemId: item._id },
        onClick: () => { window.location.href = "/admin/forecast"; },
    });
};

export {
    isSupported, getPermission, requestPermission, notify,
    notifyNewOrder, notifyOrderReady, notifyQROrder, notifyPayment, notifyLowStock,
    PERMISSION_GRANTED, PERMISSION_DENIED, PERMISSION_DEFAULT,
};
