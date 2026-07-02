import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA (vite-plugin-pwa) je namenoma onemogočen — aplikacija se zanaša na
    // IndexedDB offline queue (utils/offlineQueue.js) za resilience, ne na
    // service worker app-shell caching. Če želiš pravi PWA, namesti
    // vite-plugin-pwa in dodaj VitePWA({ registerType: 'autoUpdate', ... }).
    // README je posodobljen, da ne omenja PWA kot aktivne funkcionalnosti.
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Code splitting — prejšnje stanje: en 1.3MB index.js chunk (gzip 390KB).
    // Sedaj razdelimo heavy vendor knjižnice v ločene chunk-e, da se lahko
    // browser cache-a neodvisno in admin/cashier bundle-i ostanejo manjši.
    // Opomba: rolldown-vite zahteva manualChunks kot Function (ne Object).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router")) {
              return "react-vendor";
            }
            if (id.includes("/@radix-ui/") || id.includes("/lucide-react") ||
                id.includes("/class-variance-authority") || id.includes("/clsx") ||
                id.includes("/tailwind-merge")) {
              return "ui-vendor";
            }
            if (id.includes("/recharts") || id.includes("/framer-motion")) {
              return "charts-vendor";
            }
            if (id.includes("/axios") || id.includes("/socket.io-client") ||
                id.includes("/zustand") || id.includes("/sonner") || id.includes("/vaul")) {
              return "data-vendor";
            }
            if (id.includes("/i18next") || id.includes("/react-i18next") ||
                id.includes("/date-fns") || id.includes("/next-themes")) {
              return "i18n-vendor";
            }
          }
          // Vse ostalo (aplikacijska koda) gre v default chunk.
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 700, // dvigni iz default 500KB (radix+react skupaj > 500KB)
  },
  test: {
    globals: true,
    environment: 'jsdom',
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    setupFiles: './src/test/setup.jsx',
    css: true,
  },
})
