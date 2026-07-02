import axios from "axios";
import { API_BASE_URL } from "@/config/api.config";

// Axios instance — baseURL prihaja iz centralnega api.config.js (en vir resnice).
// Prej je bil URL hardcodiran tukaj in se ni ujemal s socket.config.js / vercel.json.
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000, // 30s timeout — prejšnje stanje: brez timeout-a (hung request je lahko zamrznil UI)
});

// Globalni 401 handler — če je session potekel, počisti auth in preusmeri na login.
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401 && typeof window !== "undefined") {
            // Ne preusmerjaj če smo že na /login ali /signup (javne strani).
            const path = window.location.pathname;
            if (!path.startsWith("/login") && !path.startsWith("/signup")) {
                // nežno: ne briši stanja direktno, pusti store naj to reši;
                // samo preusmeri. Store checkAuth() bo na naslednji mount ugotovil.
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
