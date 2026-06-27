import { create } from "zustand";
import axios from "axios";

// Poseben axios instance brez credentials — javni API
const publicApi = axios.create({
    baseURL: import.meta.env.DEV || window.location.hostname === "localhost"
        ? "http://localhost:3000/api/public"
        : "/api/public",
    withCredentials: false,
});

export const useQROrderStore = create((set, get) => ({
    // Stanje
    menuByCategory: [],
    menuItems: [],
    categories: [],
    table: null,
    cart: [],         // [{ menuItemId, name, price, quantity, image }]
    customerName: "",
    customerPhone: "",
    isLoading: false,
    isSubmitting: false,
    lastOrder: null,
    error: null,

    // Naloži meni in mizo
    loadData: async (tableId) => {
        set({ isLoading: true, error: null });
        try {
            const [menuRes, tableRes] = await Promise.all([
                publicApi.get("/menu"),
                publicApi.get(`/table/${tableId}`),
            ]);
            set({
                menuByCategory: menuRes.data.menuByCategory || [],
                menuItems: menuRes.data.menuItems || [],
                categories: menuRes.data.categories || [],
                table: tableRes.data.table,
                isLoading: false,
            });
        } catch (error) {
            console.error("QR load error:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || "Failed to load menu",
            });
        }
    },

    // Cart operacije
    addToCart: (menuItem, quantity = 1, modifiers = [], unitPrice = null) => {
        const { cart } = get();
        const finalPrice = unitPrice || menuItem.price;
        // Key vključuje modifierje — isti artikel z drugačnimi modifierji je ločen entry
        const modKey = modifiers.map(m => m.modifierName).sort().join("|");
        const cartKey = `${menuItem._id}_${modKey}`;
        const existing = cart.find(i => i.cartKey === cartKey);
        if (existing) {
            set({
                cart: cart.map(i =>
                    i.cartKey === cartKey
                        ? { ...i, quantity: i.quantity + quantity }
                        : i
                )
            });
        } else {
            set({
                cart: [...cart, {
                    cartKey,
                    menuItemId: menuItem._id,
                    name: menuItem.name,
                    price: finalPrice,
                    image: menuItem.image,
                    quantity,
                    modifiers,
                    unitPrice: finalPrice,
                }]
            });
        }
    },

    removeFromCart: (cartKey) => {
        const { cart } = get();
        const existing = cart.find(i => i.cartKey === cartKey);
        if (existing && existing.quantity > 1) {
            set({
                cart: cart.map(i =>
                    i.cartKey === cartKey
                        ? { ...i, quantity: i.quantity - 1 }
                        : i
                )
            });
        } else {
            set({ cart: cart.filter(i => i.cartKey !== cartKey) });
        }
    },

    setQuantity: (menuItemId, qty) => {
        if (qty < 1) {
            set(state => ({ cart: state.cart.filter(i => i.menuItemId !== menuItemId) }));
        } else {
            set(state => ({
                cart: state.cart.map(i =>
                    i.menuItemId === menuItemId ? { ...i, quantity: qty } : i
                )
            }));
        }
    },

    clearCart: () => set({ cart: [] }),

    setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone }),

    // Oddaj naročilo
    placeOrder: async (tableId) => {
        const { cart, customerName, customerPhone } = get();
        if (cart.length === 0) {
            return { success: false, message: "Cart is empty" };
        }
        set({ isSubmitting: true, error: null });
        try {
            const res = await publicApi.post("/order", {
                tableId,
                customerName: customerName || "Guest",
                customerPhone: customerPhone || "",
                items: cart.map(i => ({
                    menuItemId: i.menuItemId,
                    quantity: i.quantity,
                    modifiers: i.modifiers || [],
                })),
            });
            set({
                isSubmitting: false,
                lastOrder: res.data.order,
                cart: [],
            });
            return res.data;
        } catch (error) {
            console.error("Place order error:", error);
            set({
                isSubmitting: false,
                error: error.response?.data?.message || "Failed to place order",
            });
            return {
                success: false,
                message: error.response?.data?.message || "Failed to place order",
            };
        }
    },

    reset: () => set({
        cart: [], customerName: "", customerPhone: "",
        lastOrder: null, error: null,
    }),

    // Getters
    getCartTotal: () => {
        const { cart } = get();
        return cart.reduce((sum, i) => sum + ((i.unitPrice || i.price) * i.quantity), 0);
    },
    getCartCount: () => {
        const { cart } = get();
        return cart.reduce((sum, i) => sum + i.quantity, 0);
    },
}));

export default useQROrderStore;
