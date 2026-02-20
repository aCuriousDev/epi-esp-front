import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: [".trycloudflare.com", ".discordsays.com", "discordsays.com"],
    headers: {
      "Content-Security-Policy":
        "frame-ancestors 'self' https://*.discordsays.com https://discordsays.com https://discord.com https://*.discord.com",
    },
  },
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    // Pre-bundle lucide-solid to avoid ad blockers blocking "fingerprint" icon requests
    include: ["lucide-solid"],
  },
});
