import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";

/**
 * Store za upravljanje z davčnimi stopnjami.
 * Aktivni tax se uporablja pri checkout-u namesto hardcoded vrednosti.
 */
export const useTaxStore = create((set, get) => ({
    activeTax: null,    // { name, rate, isActive }
    isLoading: false,
    error: null,

    getActiveTax: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await axiosInstance.get("/tax/active");
            set({ activeTax: res.data.tax, isLoading: false });
            return res.data.tax;
        } catch (error) {
            console.error("Get active tax error:", error);
            // Fallback na 0% če API ne deluje — checkout še vedno deluje
            set({
                activeTax: { name: "Default", rate: 0, isActive: false },
                isLoading: false,
                error: error.response?.data?.message || "Failed to load tax"
            });
            return { name: "Default", rate: 0, isActive: false };
        }
    },

    // Vrne tax rate kot decimal (npr. 0.05 za 5%)
    getTaxRate: () => {
        const tax = get().activeTax;
        return tax ? (tax.rate || 0) / 100 : 0;
    },

    clearTax: () => set({ activeTax: null, error: null })
}));

export default useTaxStore;
