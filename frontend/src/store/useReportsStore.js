import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";

export const useReportsStore = create((set) => ({
    dashboard: null,
    categoryPerformance: [],
    isLoading: false,
    error: null,
    period: "monthly",
    dateRange: { startDate: "", endDate: "" },

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

export default useReportsStore;
