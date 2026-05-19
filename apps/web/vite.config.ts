import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.API_TARGET ?? "http://127.0.0.1:5173";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    // Proxy API + media requests to the Fastify server during `vite dev`,
    // so the frontend works the same in dev and prod (where Fastify serves
    // the built bundle directly).
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/media": { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
  },
});
