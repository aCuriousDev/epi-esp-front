// vite.config.ts
import { defineConfig } from "file:///C:/Epitech/DnDiscordRepo/epi-esp-front/dndiscord-esp/node_modules/vite/dist/node/index.js";
import solidPlugin from "file:///C:/Epitech/DnDiscordRepo/epi-esp-front/dndiscord-esp/node_modules/vite-plugin-solid/dist/esm/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "C:\\Epitech\\DnDiscordRepo\\epi-esp-front\\dndiscord-esp";
var vite_config_default = defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    host: true,
    port: 3e3,
    allowedHosts: [
      ".ngrok-free.dev",
      ".ngrok.io",
      ".ngrok.app",
      ".trycloudflare.com",
      ".pages.dev",
      ".discordsays.com",
      "discordsays.com"
    ],
    headers: {
      "Content-Security-Policy": "frame-ancestors 'self' https://*.discordsays.com https://discordsays.com https://discord.com https://*.discord.com"
    }
  },
  optimizeDeps: {
    // Pre-bundle lucide-solid to avoid ad blockers blocking "fingerprint" icon requests
    include: ["lucide-solid", "solid-js", "@solidjs/router"],
    exclude: []
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "lucide-solid": ["lucide-solid"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxFcGl0ZWNoXFxcXERuRGlzY29yZFJlcG9cXFxcZXBpLWVzcC1mcm9udFxcXFxkbmRpc2NvcmQtZXNwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxFcGl0ZWNoXFxcXERuRGlzY29yZFJlcG9cXFxcZXBpLWVzcC1mcm9udFxcXFxkbmRpc2NvcmQtZXNwXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9FcGl0ZWNoL0RuRGlzY29yZFJlcG8vZXBpLWVzcC1mcm9udC9kbmRpc2NvcmQtZXNwL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHNvbGlkUGx1Z2luIGZyb20gXCJ2aXRlLXBsdWdpbi1zb2xpZFwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbc29saWRQbHVnaW4oKV0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiB0cnVlLFxyXG4gICAgcG9ydDogMzAwMCxcclxuICAgIGFsbG93ZWRIb3N0czogW1xyXG4gICAgICAnLm5ncm9rLWZyZWUuZGV2JyxcclxuICAgICAgJy5uZ3Jvay5pbycsXHJcbiAgICAgICcubmdyb2suYXBwJyxcclxuICAgICAgJy50cnljbG91ZGZsYXJlLmNvbScsXHJcbiAgICAgICcucGFnZXMuZGV2JyxcclxuICAgICAgJy5kaXNjb3Jkc2F5cy5jb20nLFxyXG4gICAgICAnZGlzY29yZHNheXMuY29tJyxcclxuICAgIF0sXHJcbiAgICBoZWFkZXJzOiB7XHJcbiAgICAgIFwiQ29udGVudC1TZWN1cml0eS1Qb2xpY3lcIjpcclxuICAgICAgICBcImZyYW1lLWFuY2VzdG9ycyAnc2VsZicgaHR0cHM6Ly8qLmRpc2NvcmRzYXlzLmNvbSBodHRwczovL2Rpc2NvcmRzYXlzLmNvbSBodHRwczovL2Rpc2NvcmQuY29tIGh0dHBzOi8vKi5kaXNjb3JkLmNvbVwiLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgLy8gUHJlLWJ1bmRsZSBsdWNpZGUtc29saWQgdG8gYXZvaWQgYWQgYmxvY2tlcnMgYmxvY2tpbmcgXCJmaW5nZXJwcmludFwiIGljb24gcmVxdWVzdHNcclxuICAgIGluY2x1ZGU6IFsnbHVjaWRlLXNvbGlkJywgJ3NvbGlkLWpzJywgJ0Bzb2xpZGpzL3JvdXRlciddLFxyXG4gICAgZXhjbHVkZTogW10sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAnbHVjaWRlLXNvbGlkJzogWydsdWNpZGUtc29saWQnXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF3VixTQUFTLG9CQUFvQjtBQUNyWCxPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLFlBQVksQ0FBQztBQUFBLEVBQ3ZCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxNQUNaO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsMkJBQ0U7QUFBQSxJQUNKO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBO0FBQUEsSUFFWixTQUFTLENBQUMsZ0JBQWdCLFlBQVksaUJBQWlCO0FBQUEsSUFDdkQsU0FBUyxDQUFDO0FBQUEsRUFDWjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osZ0JBQWdCLENBQUMsY0FBYztBQUFBLFFBQ2pDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
