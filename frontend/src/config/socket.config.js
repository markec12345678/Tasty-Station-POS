import { io } from "socket.io-client";
import { SOCKET_URL } from "@/config/api.config";

// SOCKET_URL prihaja iz centralnega api.config.js (en vir resnice).
// Prejšnje stanje: URL hardcodiran tukaj in se ni ujemal z axios baseURL.

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
