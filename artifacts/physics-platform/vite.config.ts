import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

// PORT jest potrzebny wyłącznie serwerowi dev/preview (command === "serve").
// `vite build` nie otwiera żadnego portu — wymaganie PORT przy buildzie
// psuło produkcyjny `pnpm build` uruchamiany bez środowiska workflow.
function requirePort(): number {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
  return port;
}

// W dev BASE_PATH musi być zgodny z prefiksem proxy (fail-fast). Przy buildzie
// produkcyjnym domyślnie "/" — aplikacja jest serwowana z katalogu głównego
// domeny; Docker/CI może nadpisać przez BASE_PATH.
function resolveBasePath(command: "build" | "serve"): string {
  const basePath = process.env.BASE_PATH;
  if (basePath) return basePath;
  if (command === "build") return "/";
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const basePath = resolveBasePath(command);
  const port = command === "serve" ? requirePort() : undefined;

  // Clerk's publishable key is baked into the static bundle. In dev it comes from
  // the Replit secret; in the Docker web image it must be supplied as a build arg
  // (it is public — never pass the secret key here).
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey) {
    throw new Error(
      "CLERK_PUBLISHABLE_KEY environment variable is required but was not provided.",
    );
  }

  return {
    base: basePath,
    define: {
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY":
        JSON.stringify(clerkPublishableKey),
    },
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: [
          "favicon.svg",
          "robots.txt",
          "apple-touch-icon.png",
          "icon-192.png",
          "icon-512.png",
        ],
        manifest: {
          name: "fizyka7 — kurs fizyki dla klasy 7",
          short_name: "fizyka7",
          description:
            "Nowoczesny kurs fizyki dla klasy 7: interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
          lang: "pl",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: "#EAF6FF",
          background_color: "#EAF6FF",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts-stylesheets" },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
