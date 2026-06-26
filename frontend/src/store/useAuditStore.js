import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";

/**
 * Store za audit log — pregled akcij v sistemu.
 */
export const useAuditStore = create((set, get) => ({
    logs: [],
    stats: null,
    pagination: {
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
    },
    filters: {
        action: "",
        entity: "",
        userId: "",
        status: "",
        startDate: "",
        endDate: "",
        search: "",
    },
    isLoading: false,
    error: null,

    getLogs: async (page = 1, limit = 50) => {
        set({ isLoading: true, error: null });
        try {
            const { filters } = get();
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            Object.entries(filters).forEach(([key, val]) => {
                if (val) params.append(key, val);
            });

            const res = await axiosInstance.get(`/audit?${params.toString()}`);
            set({
                logs: res.data.logs,
                pagination: res.data.pagination,
                isLoading: false,
            });
            return res.data;
        } catch (error) {
            console.error("Get audit logs error:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || "Failed to load audit logs"
            });
            return null;
        }
    },

    getStats: async (startDate, endDate) => {
        try {
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            const res = await axiosInstance.get(`/audit/stats?${params.toString()}`);
            set({ stats: res.data.stats });
            return res.data.stats;
        } catch (error) {
            console.error("Get audit stats error:", error);
            return null;
        }
    },

    setFilter: (key, value) => {
        set(state => ({
            filters: { ...state.filters, [key]: value }
        }));
    },

    clearFilters: () => {
        set({
            filters: {
                action: "", entity: "", userId: "", status: "",
                startDate: "", endDate: "", search: ""
            }
        });
    },

    deleteOlder: async (olderThan) => {
        try {
            const res = await axiosInstance.delete(`/audit?olderThan=${olderThan}`);
            return res.data;
        } catch (error) {
            console.error("Delete audit logs error:", error);
            return { success: false };
        }
    },
}));

export default useAuditStore;
