import { defineConfig } from "vite";

const apiTarget = process.env.NIGHTPAWS_API_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": apiTarget,
    },
  },
  preview: {
    proxy: {
      "/api": apiTarget,
    },
  },
});
