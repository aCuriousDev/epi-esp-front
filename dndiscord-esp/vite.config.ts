import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true, // Allow external connections
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app',
      '.trycloudflare.com', // Cloudflare Tunnel
      '.pages.dev', // Cloudflare Pages
    ],
  },
  optimizeDeps: {
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
