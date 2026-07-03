import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

/**
 * Stock Movement store — v1.6.0+ backend.
 *
 * Upravlja stock gibanja (audit trail vseh sprememb zaloge):
 *   - Seznam gibanj z filtri (inventory, type, datumski range)
 *   - Agregirana statistika za dashboard
 *   - Zgodovina za posamezni inventory item (stock card)
 *   - Restock (ročna dopolnitev)
 *   - Adjust (ročna korekcija)
 */
export const useStockMovementStore = create((set, get) => ({
    movements: [],
    stats: null,
    isLoading: false,
    pagination: {
        total: 0,
        totalPages: 0,
        currentPage: 1,
        limit: 50,
    },

    // === Seznam gibanj z filtri ===
    getMovements: async (params = {}) => {
        set({ isLoading: true });
        try {
            const query = new URLSearchParams({
                page: params.page || 1,
                limit: params.limit || 50,
                ...(params.inventory && { inventory: params.inventory }),
                ...(params.type && { type: params.type }),
                ...(params.order && { order: params.order }),
                ...(params.outlet && { outlet: params.outlet }),
                ...(params.startDate && { startDate: params.startDate }),
                ...(params.endDate && { endDate: params.endDate }),
            }).toString();

            const res = await axiosInstance.get(`/stock-movements?${query}`);
            set({
                movements: res.data.movements || [],
                pagination: res.data.pagination || get().pagination,
                isLoading: false,
            });
        } catch (error) {
            console.error("Get stock movements error:", error);
            set({ isLoading: false });
        }
    },

    // === Agregirana statistika ===
    getStats: async (startDate, endDate) => {
        try {
            const query = new URLSearchParams();
            if (startDate) query.append("startDate", startDate);
            if (endDate) query.append("endDate", endDate);
            const res = await axiosInstance.get(`/stock-movements/stats?${query.toString()}`);
            set({ stats: res.data.stats });
            return res.data.stats;
        } catch (error) {
            console.error("Get stock movement stats error:", error);
            return null;
        }
    },

    // === Zgodovina za posamezni inventory item (stock card) ===
    getInventoryHistory: async (inventoryId) => {
        try {
            const res = await axiosInstance.get(`/stock-movements/inventory/${inventoryId}`);
            return res.data.movements || [];
        } catch (error) {
            console.error("Get inventory history error:", error);
            return [];
        }
    },

    // === Restock (ročna dopolnitev) ===
    restock: async (data) => {
        try {
            const res = await axiosInstance.post("/stock-movements/restock", data);
            if (res.data.success) {
                toast.success(`Restocked ${data.quantity} units`);
                get().getMovements();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to restock");
            return { success: false };
        }
    },

    // === Adjust (ročna korekcija) ===
    adjust: async (data) => {
        try {
            const res = await axiosInstance.post("/stock-movements/adjust", data);
            if (res.data.success) {
                toast.success("Stock adjusted");
                get().getMovements();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to adjust stock");
            return { success: false };
        }
    },
}));

export default useStockMovementStore;
