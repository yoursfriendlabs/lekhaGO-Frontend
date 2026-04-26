import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",
      includeAssets: ["Logo.png", "Logo.png"],
      manifest: {
        id: "/",
        name: "PasalManager",
        short_name: "Pasal",
        description:
          "Business management for inventory, sales, purchases, services, and parties.",
        lang: "en",
        start_url: "/app",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f8f5f2",
        theme_color: "#9b6835",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/Logo.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webp}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === "image" &&
              url.origin === self.location.origin,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-images",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === "font" &&
              url.origin === self.location.origin,
            handler: "CacheFirst",
            options: {
              cacheName: "app-fonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    mode === "test" ? null : cloudflare(),
  ].filter(Boolean),
  server: {
    port: 5173,
    watch: {
      ignored: [
        "**/*.{test,spec}.{js,jsx,ts,tsx}",
        "**/src/test/**",
      ],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
  },
}));
