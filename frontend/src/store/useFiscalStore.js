import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

export const useFiscalStore = create((set, get) => ({
    invoices: [],
    stats: null,
    pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
    filters: {
        status: "",
        outletId: "",
        startDate: "",
        endDate: "",
        search: "",
    },
    isLoading: false,

    getInvoices: async (page = 1, limit = 50) => {
        set({ isLoading: true });
        try {
            const { filters } = get();
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
            const res = await axiosInstance.get(`/fiscal?${params.toString()}`);
            set({ invoices: res.data.invoices, pagination: res.data.pagination, isLoading: false });
        } catch (error) {
            console.error("Get fiscal invoices error:", error);
            set({ isLoading: false });
        }
    },

    getStats: async (startDate, endDate) => {
        try {
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            const res = await axiosInstance.get(`/fiscal/stats?${params.toString()}`);
            set({ stats: res.data.stats });
        } catch (error) { console.error("Get fiscal stats error:", error); }
    },

    retryInvoice: async (id) => {
        try {
            const res = await axiosInstance.post(`/fiscal/${id}/retry`);
            if (res.data.success) {
                toast.success("Invoice confirmed successfully");
                get().getInvoices(get().pagination.page);
                get().getStats();
            } else {
                toast.error(res.data.message || "Retry failed");
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Retry failed");
            return { success: false };
        }
    },

    setFilter: (key, value) => set(state => ({ filters: { ...state.filters, [key]: value } })),
    clearFilters: () => set({ filters: { status: "", outletId: "", startDate: "", endDate: "", search: "" } }),
}));

export default useFiscalStore;
