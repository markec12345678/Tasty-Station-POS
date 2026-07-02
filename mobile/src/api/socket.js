/**
 * Socket.io konfiguracija za mobilno aplikacijo.
 *
 * Poveže se na backend Socket.io server (isti origin kot REST API, brez /api).
 * Avtentikacija: Bearer token v auth handshake (backend auth.middleware sprejema
 * Authorization: Bearer kot fallback ko ni piščka — implementirano v krogu 1).
 *
 * Prejšnje stanje: mobile KitchenScreen je uporabljal HTTP polling (10s interval)
 * — README je lagal o "real-time". Sedaj je pravi Socket.io.
 */
import { io } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

// Backend origin = API_URL brez /api končnice.
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

let socket = null;

export const initSocket = async () => {
    if (socket) return socket;

    const token = await SecureStore.getItemAsync("auth_token");

    socket = io(SOCKET_URL, {
        autoConnect: false,
        auth: { token }, // backend auth.middleware prebere iz handshake
        transports: ["websocket"], // RN ne podpira polling fallback dobro
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
    });

    socket.on("connect", () => console.log("[Socket] Connected:", socket.id));
    socket.on("disconnect", (r) => console.log("[Socket] Disconnected:", r));
    socket.on("connect_error", (e) => console.warn("[Socket] Error:", e.message));

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        console.warn("[Socket] getSocket() called before initSocket() — initializing now");
        initSocket();
    }
    return socket;
};

export const connectSocket = () => {
    const s = getSocket();
    if (s && !s.connected) s.connect();
};

export const disconnectSocket = () => {
    if (socket && socket.connected) socket.disconnect();
};
