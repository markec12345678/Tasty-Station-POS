import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { login as apiLogin, logout as apiLogout, getStoredUser } from "../api/client";

export const useAuthStore = create((set) => ({
    user: null, isLoading: false, isAuthenticated: false,
    init: async () => {
        const user = await getStoredUser();
        if (user) set({ user, isAuthenticated: true });
    },
    login: async (email, password) => {
        set({ isLoading: true });
        try {
            const data = await apiLogin(email, password);
            if (data.success) { set({ user: data.user, isAuthenticated: true, isLoading: false }); return true; }
            set({ isLoading: false }); return false;
        } catch (error) { set({ isLoading: false }); throw error; }
    },
    logout: async () => { await apiLogout(); set({ user: null, isAuthenticated: false }); },
}));
