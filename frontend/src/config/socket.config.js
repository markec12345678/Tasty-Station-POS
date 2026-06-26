import { io } from "socket.io-client";

// V lokalnem okolju (dev ali preview na localhost) uporabi lokalni backend.
const isLocal = import.meta.env.DEV
    || (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"));

const SOCKET_URL = isLocal
    ? "http://localhost:3000"
    : (import.meta.env.VITE_API_BASE_URL || "https://tastystation-bg.vercel.app");

let socket = null;

export const initSocket = () => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            withCredentials: true,
            autoConnect: false // We will connect manually when needed (e.g., after login)
        });

        socket.on("connect", () => {
            console.log("Connected to Socket.io server with ID:", socket.id);
        });

        socket.on("disconnect", (reason) => {
            console.log("Disconnected from Socket.io server. Reason:", reason);
        });

        socket.on("connect_error", (err) => {
            console.error("Socket.io connection error:", err.message);
        });
    }

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        console.warn("Socket.io requested before initialization. Initializing now...");
        return initSocket();
    }
    return socket;
};

export const connectSocket = () => {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
    }
};

export const disconnectSocket = () => {
    if (socket && socket.connected) {
        socket.disconnect();
    }
};
