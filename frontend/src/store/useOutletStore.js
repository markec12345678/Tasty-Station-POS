import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

export const useOutletStore = create((set, get) => ({
    outlets: [],
    isLoading: false,
    error: null,

    getOutlets: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await axiosInstance.get("/outlets");
            set({ outlets: res.data.outlets || [], isLoading: false });
            return res.data.outlets;
        } catch (error) {
            console.error("Get outlets error:", error);
            set({
                isLoading: false,
                error: error.response?.data?.message || "Failed to load outlets"
            });
            return [];
        }
    },

    createOutlet: async (data) => {
        try {
            const res = await axiosInstance.post("/outlets", data);
            if (res.data.success) {
                toast.success(`Outlet "${data.name}" created`);
                get().getOutlets();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create outlet");
            return { success: false };
        }
    },

    updateOutlet: async (id, data) => {
        try {
            const res = await axiosInstance.put(`/outlets/${id}`, data);
            if (res.data.success) {
                toast.success("Outlet updated");
                get().getOutlets();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update outlet");
            return { success: false };
        }
    },

    deleteOutlet: async (id) => {
        try {
            const res = await axiosInstance.delete(`/outlets/${id}`);
            if (res.data.success) {
                toast.success("Outlet deactivated");
                get().getOutlets();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to deactivate outlet");
            return { success: false };
        }
    },

    setPrimary: async (id) => {
        try {
            const res = await axiosInstance.post(`/outlets/${id}/set-primary`);
            if (res.data.success) {
                toast.success("Primary outlet set");
                get().getOutlets();
            }
            return res.data;
        } catch (_error) {
            toast.error("Failed to set primary outlet");
            return { success: false };
        }
    },
}));

export default useOutletStore;
