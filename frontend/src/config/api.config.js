/**
 * Centralna konfiguracija backend URL-jev — EN vir resnice.
 *
 * Prejšnje stanje: 3 različni hostnam-i po kodeksi:
 *   - axiosInstace.js  → https://tastystation-bg.vercel.app/api
 *   - socket.config.js → https://tastystation-bg.vercel.app  (brez /api)
 *   - vercel.json      → https://tasty-station-backend.vercel.app/api
 * To je povzročalo, da real-time (Socket.io) v produkciji ni deloval.
 *
 * Sedaj axios in socket.config uvozita URL iz te datoteke.
 *
 * V produkciji lahko override-aš z env var:
 *   VITE_API_BASE_URL=https://tvoj-backend.com   (brez /api)
 */

const isLocal =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"));

// Osnovni backend origin (brez /api) — uporablja se za Socket.io.
export const BACKEND_ORIGIN = isLocal
    ? "http://localhost:3000"
    : import.meta.env.VITE_API_BASE_URL || "https://tastystation-bg.vercel.app";

// Axios baseURL — backend origin + /api.
export const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

// Socket.io URL (brez /api — Socket.io teče na rootu).
export const SOCKET_URL = BACKEND_ORIGIN;
