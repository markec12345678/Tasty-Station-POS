import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

/**
 * Store za upravljanje valute in formatiranja zneskov.
 * Default: EUR (Slovenija) z 22% DDV.
 */
export const useCurrencyStore = create((set, get) => ({
    settings: null,
    presets: [],
    isLoading: false,

    getSettings: async () => {
        try {
            const res = await axiosInstance.get("/currency");
            set({ settings: res.data.settings, presets: res.data.presets });
            return res.data.settings;
        } catch (error) {
            console.error("Get currency settings error:", error);
            // Fallback na EUR
            const fallback = {
                code: "EUR", symbol: "€", symbolPosition: "after", decimals: 2,
                locale: "sl-SI", thousandsSeparator: ".", decimalSeparator: ",",
                taxRates: { standard: 22, reduced: 9.5, specialReduced: 5 },
                taxInclusive: true
            };
            set({ settings: fallback });
            return fallback;
        }
    },

    updateSettings: async (data) => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.put("/currency", data);
            set({ settings: res.data.settings, isLoading: false });
            toast.success("Currency settings updated");
            return res.data;
        } catch (error) {
            set({ isLoading: false });
            toast.error(error.response?.data?.message || "Failed to update currency");
            return { success: false };
        }
    },

    applyPreset: async (code) => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.post(`/currency/preset/${code}`);
            set({ settings: res.data.settings, isLoading: false });
            toast.success(`Currency switched to ${res.data.message}`);
            return res.data;
        } catch (error) {
            set({ isLoading: false });
            toast.error(error.response?.data?.message || "Failed to switch currency");
            return { success: false };
        }
    },

    // Formatiraj znesek glede na nastavitve (npr. "10,50 €" za EUR ali "$10.50" za USD)
    format: (amount) => {
        const s = get().settings;
        if (!s) return `${amount}`;
        if (typeof amount !== "number" || isNaN(amount)) amount = 0;
        const fixed = amount.toFixed(s.decimals);
        const [intPart, decPart] = fixed.split(".");
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, s.thousandsSeparator);
        const formatted = decPart
            ? `${formattedInt}${s.decimalSeparator}${decPart}`
            : formattedInt;
        return s.symbolPosition === "before"
            ? `${s.symbol}${formatted}`
            : `${formatted} ${s.symbol}`;
    },

    // Formatiraj brez simbola (samo številka)
    formatAmount: (amount) => {
        const s = get().settings;
        if (!s) return `${amount}`;
        if (typeof amount !== "number" || isNaN(amount)) amount = 0;
        const fixed = amount.toFixed(s.decimals);
        const [intPart, decPart] = fixed.split(".");
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, s.thousandsSeparator);
        return decPart ? `${formattedInt}${s.decimalSeparator}${decPart}` : formattedInt;
    },

    // Vrne simbol valute (npr. "€" ali "$")
    symbol: () => get().settings?.symbol || "€",

    // Vrne DDV stopnjo (splošna, znižana, posebej znižana)
    taxRate: (type = "standard") => {
        const s = get().settings;
        return s?.taxRates?.[type] ?? 0;
    },
}));

export default useCurrencyStore;
