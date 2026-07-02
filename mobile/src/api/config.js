/**
 * Centralna konfiguracija backend URL-ja za mobilno aplikacijo.
 *
 * Prejšnje stanje: hardcoded "http://localhost:3000/api" v client.js —
 * v produkciji mobilna aplikacija ni delovala.
 *
 * Sedaj je URL konfigurabilen preko Expo public env var:
 *   EXPO_PUBLIC_API_URL=https://tvoj-backend.com/api
 *
 * Nastavi ga v `.env` (Expo) ali v EAS Environment Variables za produkcijo.
 * Default ostane localhost za lokalni development.
 */
export const API_URL =
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
