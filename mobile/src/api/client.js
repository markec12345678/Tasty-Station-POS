import axios from "axios";
import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";

const API_URL = "http://localhost:3000/api";

const api = axios.create({ baseURL: API_URL, timeout: 10000, withCredentials: true });

api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync("auth_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use((r) => r, async (error) => {
    if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync("auth_token");
        await SecureStore.deleteItemAsync("user_data");
    }
    return Promise.reject(error);
});

export const login = async (email, password) => {
    const res = await api.post("/users/login", { email, password });
    if (res.data.success) {
        await SecureStore.setItemAsync("auth_token", res.data.token || "session");
        await SecureStore.setItemAsync("user_data", JSON.stringify(res.data.user));
    }
    return res.data;
};

export const logout = async () => {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("user_data");
};

export const getStoredUser = async () => {
    const data = await SecureStore.getItemAsync("user_data");
    return data ? JSON.parse(data) : null;
};

export const isOnline = async () => {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected && state.isInternetReachable;
};

export const getMenu = () => api.get("/menu/item");
export const getTables = () => api.get("/table");
export const createOrder = (orderData) => api.post("/orders", orderData);
export const getKitchenOrders = () => api.get("/orders/kitchen");
export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status });
export const getMyOrders = () => api.get("/orders?limit=20");
export const getStats = () => api.get("/orders/stats");

export default api;
