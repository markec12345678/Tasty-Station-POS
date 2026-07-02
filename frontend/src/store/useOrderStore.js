import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import axiosInstance from "../axios/axiosInstace";
import { getSocket } from "../config/socket.config";
import { notifyOrderReady, notifyQROrder, notifyPayment } from "../utils/notifications";

export const useOrderStore = create(
    devtools(
        persist(
            (set, get) => ({
                cart: [],
                isLoading: false,
                error: null,
                lastOrder: null, // For billing slip
                stats: null,
                recentOrders: [],
                pagination: {
                    totalOrders: 0,
                    totalPages: 0,
                    currentPage: 1,
                    limit: 10
                },
                // Track if listeners are active to prevent duplicates
                listenersActive: false,

                // === Cart z modifier podporo ===
                // Prejšnje stanje: cart key je bil samo menuItem._id — POS terminal
                // ni mogel prodati istega artikla z različnimi modifierji (npr. dve
                // kavi z različnim mlekom). Sedaj cartKey vključe modifierje.
                // Backward-compat: brez modifierjev je cartKey = menuItem._id (string),
                // kar ustreza obstoječim klicem iz OrderPage (removeFromCart(item._id)).
                addToCart: (menuItem, modifiers = []) => {
                    const { cart } = get();
                    // Composite key: menuItem._id + sorted modifier names.
                    // Brez modifierjev je cartKey = menuItem._id (backward-compat).
                    const modKey = (modifiers || []).map(m => m.modifierName).sort().join("|");
                    const cartKey = modifiers && modifiers.length > 0
                        ? `${menuItem._id}__${modKey}`
                        : menuItem._id;

                    // Izračunaj unitPrice iz modifierjev (priceOverride > base + sum adjustments)
                    let unitPrice = menuItem.price;
                    if (modifiers && modifiers.length > 0) {
                        for (const mod of modifiers) {
                            if (mod.priceOverride != null) {
                                unitPrice = mod.priceOverride;
                            } else {
                                unitPrice += mod.priceAdjustment || 0;
                            }
                        }
                    }

                    const existingItem = cart.find(item => item.cartKey === cartKey);
                    if (existingItem) {
                        set({
                            cart: cart.map(item =>
                                item.cartKey === cartKey
                                    ? { ...item, quantity: item.quantity + 1 }
                                    : item
                            )
                        });
                    } else {
                        set({
                            cart: [...cart, {
                                cartKey,
                                menuItem,
                                quantity: 1,
                                name: menuItem.name,
                                price: menuItem.price, // base price (snapshot)
                                unitPrice, // z modifierji
                                modifiers: modifiers || [],
                            }]
                        });
                    }
                },

                removeFromCart: (cartKey) => {
                    const { cart } = get();
                    // Backward-compat: če cartKey ne matcha točno, poskusi z menuItem._id
                    // (za stare klice iz OrderPage ki ne pošiljajo cartKey-ja).
                    const existingItem = cart.find(item => item.cartKey === cartKey)
                        || cart.find(item => item.menuItem._id === cartKey);
                    const matchKey = existingItem ? existingItem.cartKey : cartKey;

                    if (existingItem && existingItem.quantity > 1) {
                        set({
                            cart: cart.map(item =>
                                item.cartKey === matchKey
                                    ? { ...item, quantity: item.quantity - 1 }
                                    : item
                            )
                        });
                    } else {
                        set({
                            cart: cart.filter(item => item.cartKey !== matchKey)
                        });
                    }
                },

                clearCart: () => set({ cart: [] }),

                getStats: async () => {
                    set({ isLoading: true });
                    try {
                        const response = await axiosInstance.get("/orders/stats");
                        set({
                            stats: response.data.stats,
                            recentOrders: response.data.recentOrders,
                            isLoading: false
                        });
                    } catch (error) {
                        console.error("Get stats error:", error);
                        set({ isLoading: false, error: "Failed to fetch dashboard stats" });
                    }
                },

                getAllOrders: async (page = 1, limit = 10, startDate = null, endDate = null) => {
                    set({ isLoading: true });
                    try {
                        let url = `/orders?page=${page}&limit=${limit}`;
                        if (startDate) url += `&startDate=${startDate}`;
                        if (endDate) url += `&endDate=${endDate}`;
                        const response = await axiosInstance.get(url);
                        set({
                            recentOrders: response.data.orders,
                            pagination: response.data.pagination,
                            isLoading: false
                        });
                    } catch (error) {
                        console.error("Get orders error:", error);
                        set({ isLoading: false, error: "Failed to fetch orders" });
                    }
                },

                placeOrder: async (orderData) => {
                    set({ isLoading: true, error: null });
                    try {
                        const response = await axiosInstance.post("/orders", orderData);
                        set({
                            isLoading: false,
                            lastOrder: response.data.order,
                            cart: []
                        });
                        return { success: true, order: response.data.order };
                    } catch (error) {
                        console.error("Place order error:", error);
                        set({
                            isLoading: false,
                            error: error.response?.data?.message || "Failed to place order"
                        });
                        return { success: false, message: error.response?.data?.message };
                    }
                },

                updateOrderStatus: async (orderId, status) => {
                    set({ isLoading: true });
                    try {
                        const response = await axiosInstance.patch(`/orders/${orderId}/status`, { status });
                        const { recentOrders } = get();
                        set({
                            recentOrders: recentOrders.map(o => o._id === orderId ? response.data.order : o),
                            isLoading: false
                        });
                        return { success: true };
                    } catch (error) {
                        console.error("Update status error:", error);
                        set({ isLoading: false, error: "Failed to update order status" });
                        return { success: false, message: error.response?.data?.message };
                    }
                },

                resetLastOrder: () => set({ lastOrder: null }),

                // --- Socket.io Integration ---
                // Priklopi notification helperje na socket dogodke.
                // Prejšnje stanje: notifyOrderReady/notifyQROrder/notifyPayment so bile
                // izvožene iz notifications.js a nikoli klicane (dead code).
                setupSocketListeners: () => {
                    const { listenersActive } = get();
                    if (listenersActive) return; // Prevent duplicate listeners

                    const socket = getSocket();

                    // Listen for new orders (e.g., placed by waitstaff, received by kitchen)
                    socket.on("newOrder", (newOrder) => {
                        const { recentOrders, stats } = get();

                        // Check if order already exists to prevent duplicates
                        if (!recentOrders.find(o => o._id === newOrder._id)) {
                            // Update recent orders (add to top)
                            const updatedOrders = [newOrder, ...recentOrders].slice(0, 10); // Keep max 10

                            // Optionally update stats broadly
                            const updatedStats = stats ? {
                                ...stats,
                                totalOrders: stats.totalOrders + 1,
                                pendingOrders: stats.pendingOrders + 1,
                                totalRevenue: stats.totalRevenue + newOrder.totalAmount
                            } : null;

                            set({
                                recentOrders: updatedOrders,
                                stats: updatedStats
                            });
                        }
                    });

                    // Listen for order status updates (e.g., from kitchen to waitstaff)
                    socket.on("orderStatusUpdate", (updatedOrder) => {
                        const { recentOrders } = get();

                        // Update the specific order in the list
                        const updatedOrders = recentOrders.map(o =>
                            o._id === updatedOrder._id ? updatedOrder : o
                        );

                        // Desktop notification ko je order Ready (prej dead code).
                        if (updatedOrder.status === "Ready") {
                            notifyOrderReady(updatedOrder);
                        }

                        set({ recentOrders: updatedOrders });
                    });

                    // Listen for QR orders (gost naroči preko QR kode).
                    // Prejšnje stanje: useOrderStore ni poslušal tega event-a —
                    // cashier-jev order list ni videl QR naročil dokler ni manual refresh.
                    socket.on("qrOrderPlaced", (qrOrder) => {
                        const { recentOrders, stats } = get();
                        if (!recentOrders.find(o => o._id === qrOrder._id)) {
                            const updatedOrders = [qrOrder, ...recentOrders].slice(0, 10);
                            const updatedStats = stats ? {
                                ...stats,
                                totalOrders: stats.totalOrders + 1,
                                pendingOrders: stats.pendingOrders + 1,
                                totalRevenue: stats.totalRevenue + (qrOrder.totalAmount || 0)
                            } : null;
                            set({ recentOrders: updatedOrders, stats: updatedStats });
                        }
                        // Desktop notification (prej dead code).
                        notifyQROrder(qrOrder);
                    });

                    // Listen for payment updates (split payments, full payment).
                    // Prejšnje stanje: useOrderStore ni poslušal — stats se niso refresh-ale.
                    socket.on("paymentUpdate", (updatedOrder) => {
                        const { recentOrders } = get();
                        const updatedOrders = recentOrders.map(o =>
                            o._id === updatedOrder._id ? updatedOrder : o
                        );
                        set({ recentOrders: updatedOrders });
                        // Desktop notification (prej dead code).
                        notifyPayment(updatedOrder);
                    });

                    set({ listenersActive: true });
                },

                cleanupSocketListeners: () => {
                    const socket = getSocket();
                    socket.off("newOrder");
                    socket.off("orderStatusUpdate");
                    socket.off("qrOrderPlaced");
                    socket.off("paymentUpdate");
                    set({ listenersActive: false });
                }
            }),
            {
                name: "order-storage",
                partialize: (state) => ({ cart: state.cart }), // only persist cart
            }
        )
    )
);
