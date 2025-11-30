import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Listen on all network interfaces (Tailscale, local network)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false, // Preserve client IP
        configure: (proxy, options) => {
          // Forward the original client IP in X-Forwarded-For header
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const clientIp = req.socket.remoteAddress;
            proxyReq.setHeader('X-Forwarded-For', clientIp);
          });
        },
      },
    },
  }
});
