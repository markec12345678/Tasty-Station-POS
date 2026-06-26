import axios from "axios";

// V lokalnem okolju (dev ali preview na localhost) uporabi lokalni backend.
// V produkciji (Vercel deploy) uporabi Vercel backend URL.
const isLocal = import.meta.env.DEV
    || (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"));

const baseURL = isLocal
    ? "http://localhost:3000/api"
    : "https://tastystation-bg.vercel.app/api";

const axiosInstance = axios.create({
    baseURL,
    withCredentials: true,
});

export default axiosInstance;
