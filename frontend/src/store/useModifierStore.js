import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

export const useModifierStore = create((set, get) => ({
    groups: [],
    isLoading: false,

    getGroups: async () => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get("/modifiers");
            set({ groups: res.data.groups || [], isLoading: false });
        } catch (error) {
            console.error("Get modifier groups error:", error);
            set({ isLoading: false });
        }
    },

    createGroup: async (data) => {
        try {
            const res = await axiosInstance.post("/modifiers", data);
            if (res.data.success) {
                toast.success("Modifier group created");
                get().getGroups();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create");
            return { success: false };
        }
    },

    updateGroup: async (id, data) => {
        try {
            const res = await axiosInstance.put(`/modifiers/${id}`, data);
            if (res.data.success) {
                toast.success("Modifier group updated");
                get().getGroups();
            }
            return res.data;
        } catch (_error) {
            toast.error("Failed to update");
            return { success: false };
        }
    },

    deleteGroup: async (id) => {
        try {
            const res = await axiosInstance.delete(`/modifiers/${id}`);
            if (res.data.success) {
                toast.success("Modifier group deleted");
                get().getGroups();
            } else {
                toast.error(res.data.message || "Cannot delete — in use");
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete");
            return { success: false };
        }
    },
}));

export default useModifierStore;
