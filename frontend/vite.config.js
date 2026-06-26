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
    // PWA onemogočen za development/preview — v produkciji znova omogoči z VitePWA({...})
    // import { VitePWA } from 'vite-plugin-pwa'
    // VitePWA({ registerType: 'autoUpdate', ... })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
