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
            // Ob (re)connectu se pridruži outlet sobi, da backend lahko pošilja
            // outlet-scoped dogodke (newOrder, paymentUpdate, ...) samo v pravo
            // sobo. Pridobimo outletId iz auth store-a (lahko null za admin/manager
            // brez dodeljenega outlet-a → pridruži se `outlet:global` sobi).
            try {
                const stored = localStorage.getItem("auth-storage");
                const outletId = stored
                    ? JSON.parse(stored)?.state?.authUser?.outletId
                    : null;
                socket.emit("join-outlet", outletId || null);
            } catch (_e) {
                // Napaka pri branju outlet-a — pridruži se global sobi (admin)
                socket.emit("join-outlet", null);
            }
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

/**
 * Sproži ponovni join outlet sobe. Uporablja se, ko se uporabnik preklopi
 * outlet (admin multi-outlet oversight) ali po ponovni prijavi z drugačnim
 * uporabnikom. Brez tega bi socket ostal v stari outlet sobi.
 *
 * @param {String|null} outletId — ObjectId outlet-a ali null za global
 */
export const joinOutletRoom = (outletId) => {
    const s = getSocket();
    if (s.connected) {
        s.emit("join-outlet", outletId || null);
    }
};

export const disconnectSocket = () => {
    if (socket && socket.connected) {
        socket.disconnect();
    }
};
