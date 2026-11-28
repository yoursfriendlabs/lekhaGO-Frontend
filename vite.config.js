import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src");

const appVersion = `${process.env.npm_package_version || "1.0.0"}·${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      // The app registers the worker itself (PwaLifecycle) and asks the user
      // before switching to a new version, so open screens never lose the
      // files they were loaded with.
      injectRegister: false,
      registerType: "prompt",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png", "Logo.png", "icon-192.png", "icon-512.png"],
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
        orientation: "any",
        display_override: ["standalone", "minimal-ui"],
        background_color: "#f8f5f2",
        theme_color: "#9b6835",
        categories: ["business", "productivity"],
        shortcuts: [
          { name: "Quick POS", short_name: "POS", url: "/app/pos", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Sales invoices", short_name: "Sales", url: "/app/sales", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Inventory", short_name: "Items", url: "/app/inventory", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Parties", short_name: "Parties", url: "/app/parties", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
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
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
}));
