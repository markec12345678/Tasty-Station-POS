import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";

/**
 * Unified report store — združuje legacy (AdminReports.jsx) in modern
 * (ReportsDashboard.jsx) report domene v en store.
 *
 * Prejšnje stanje: dva paralelna store-a:
 *   - useReportStore (legacy) — salesData, cashierData, topItemsData, profitLossData
 *   - useReportsStore (modern) — dashboard, categoryPerformance
 * Oba sta klicala /reports/* endpoint-e. Duplikacija je bila confusing.
 *
 * useReportsStore.js je sedaj re-export wrapper tega store-a (backward-compat).
 */
const useReportStore = create((set) => ({
    // === Legacy (AdminReports.jsx) ===
    salesData: [],
    cashierData: [],
    topItemsData: [],
    profitLossData: { totalRevenue: 0, totalCost: 0, profit: 0, orderCount: 0 },

    // === Modern (ReportsDashboard.jsx) ===
    dashboard: null,
    categoryPerformance: [],
    period: "monthly",
    dateRange: { startDate: "", endDate: "" },

    isLoading: false,
    error: null,

    // === Legacy akcije ===
    fetchSalesReports: async (filter = "daily") => {
        set({ isLoading: true });
        try {
            const response = await axiosInstance.get(`/reports/sales?filter=${filter}`);
            set({ salesData: response.data.data, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    fetchCashierCollections: async (filter = "daily") => {
        set({ isLoading: true });
        try {
            const response = await axiosInstance.get(`/reports/cashier-collections?filter=${filter}`);
            set({ cashierData: response.data.data, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    fetchTopSellingItems: async (filter = "daily", limit = 10) => {
        set({ isLoading: true });
        try {
            const response = await axiosInstance.get(`/reports/top-selling?filter=${filter}&limit=${limit}`);
            set({ topItemsData: response.data.data, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    fetchProfitLoss: async (filter = "monthly") => {
        set({ isLoading: true });
        try {
            const response = await axiosInstance.get(`/reports/profit-loss?filter=${filter}`);
            set({ profitLossData: response.data.data, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    // === Modern akcije ===
    getDashboard: async (filter = "monthly", startDate = "", endDate = "") => {
        set({ isLoading: true, error: null, period: filter });
        try {
            const params = new URLSearchParams({ filter });
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            const res = await axiosInstance.get(`/reports/dashboard?${params.toString()}`);
            set({ dashboard: res.data.dashboard, isLoading: false });
            return res.data;
        } catch (error) {
            console.error("Get dashboard error:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || "Failed to load dashboard"
            });
            return null;
        }
    },

    getCategoryPerformance: async (filter = "monthly") => {
        try {
            const res = await axiosInstance.get(`/reports/category-performance?filter=${filter}`);
            set({ categoryPerformance: res.data.data || [] });
            return res.data;
        } catch (error) {
            console.error("Get category performance error:", error);
            return null;
        }
    },

    setDateRange: (startDate, endDate) => set({ dateRange: { startDate, endDate } }),
}));

export default useReportStore;
