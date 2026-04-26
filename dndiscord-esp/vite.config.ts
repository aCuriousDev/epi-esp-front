/// <reference types="vitest" />
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app',
      '.trycloudflare.com',
      '.pages.dev',
      '.discordsays.com',
      'discordsays.com',
    ],
    headers: {
      "Content-Security-Policy":
        "frame-ancestors 'self' https://*.discordsays.com https://discordsays.com https://discord.com https://*.discord.com",
    },
  },
  optimizeDeps: {
    // Pre-bundle lucide-solid to avoid ad blockers blocking "fingerprint" icon requests
    include: ['lucide-solid', 'solid-js', '@solidjs/router'],
    exclude: [],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'lucide-solid': ['lucide-solid'],
        },
      },
    },
  },
});
