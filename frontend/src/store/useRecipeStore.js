import { create } from "zustand";
import axiosInstance from "../axios/axiosInstace";
import { toast } from "sonner";

/**
 * Recipe (Bill of Materials) store — v1.3.0+ backend.
 *
 * Recipe povezuje MenuItem z Inventory sestavinami s količinami.
 * Uporablja se za:
 *   1. Pravo inventory forecasting (namesto besednega ujemanja)
 *   2. Recipe costing (koliko stane izdelava jedi)
 *   3. Margin analysis (price - cost = profit)
 */
export const useRecipeStore = create((set, get) => ({
    recipes: [],
    isLoading: false,
    costing: null, // trenutni costing za izbran menu item

    // === Seznam vseh receptov ===
    getRecipes: async () => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get("/recipes");
            set({ recipes: res.data.recipes || [], isLoading: false });
        } catch (error) {
            console.error("Get recipes error:", error);
            set({ isLoading: false });
        }
    },

    // === Recept za specifičen menu item ===
    getRecipeByMenuItem: async (menuItemId) => {
        try {
            const res = await axiosInstance.get(`/recipes/${menuItemId}`);
            return res.data.recipe || null;
        } catch (error) {
            // 404 je normalen — recept ne obstaja
            if (error.response?.status === 404) return null;
            console.error("Get recipe error:", error);
            return null;
        }
    },

    // === Upsert (ustvari ali posodobi) recept ===
    saveRecipe: async (data) => {
        try {
            const res = await axiosInstance.post("/recipes", data);
            if (res.data.success) {
                toast.success(data._id ? "Recipe updated" : "Recipe created");
                get().getRecipes();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to save recipe");
            return { success: false };
        }
    },

    // === Soft delete recept ===
    deleteRecipe: async (id) => {
        try {
            const res = await axiosInstance.delete(`/recipes/${id}`);
            if (res.data.success) {
                toast.success("Recipe deleted");
                get().getRecipes();
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete");
            return { success: false };
        }
    },

    // === Recipe costing za menu item ===
    getCosting: async (menuItemId) => {
        try {
            const res = await axiosInstance.get(`/recipes/${menuItemId}/cost`);
            set({ costing: res.data.costing });
            return res.data.costing;
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error("Get costing error:", error);
            }
            set({ costing: null });
            return null;
        }
    },
}));

export default useRecipeStore;
