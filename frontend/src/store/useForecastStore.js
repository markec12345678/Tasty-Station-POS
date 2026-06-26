import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

export const useForecastStore = create((set) => ({
    forecast: null,
    lowStock: [],
    isLoading: false,
    error: null,
    period: 30,

    getForecast: async (days = 30) => {
        set({ isLoading: true, error: null, period: days });
        try {
            const res = await axiosInstance.get(`/inventory-forecast/forecast?days=${days}`);
            set({ forecast: res.data.forecast, isLoading: false });
            return res.data.forecast;
        } catch (error) {
            console.error("Get forecast error:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || "Failed to load forecast"
            });
            toast.error("Failed to load AI forecast");
            return null;
        }
    },

    getLowStock: async () => {
        try {
            const res = await axiosInstance.get("/inventory-forecast/forecast/low-stock");
            set({ lowStock: res.data.items || [] });
            return res.data;
        } catch (error) {
            console.error("Get low stock error:", error);
            return null;
        }
    },
}));

export default useForecastStore;
