import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

export const useZReportStore = create((set) => ({
    zReport: null,
    xReport: null,
    isLoading: false,

    getZReport: async (date) => {
        set({ isLoading: true });
        try {
            const params = date ? `?date=${date}` : "";
            const res = await axiosInstance.get(`/z-report/z-report${params}`);
            set({ zReport: res.data.zReport, isLoading: false });
            return res.data.zReport;
        } catch (_error) {
            toast.error("Failed to load Z-Report");
            set({ isLoading: false });
            return null;
        }
    },

    getXReport: async () => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get("/z-report/x-report");
            set({ xReport: res.data.xReport, isLoading: false });
            return res.data.xReport;
        } catch (_error) {
            toast.error("Failed to load X-Report");
            set({ isLoading: false });
            return null;
        }
    },
}));

export default useZReportStore;
