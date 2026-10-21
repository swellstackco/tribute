import { defineConfig } from "vite";
export default defineConfig({
  root: "src/web",
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:5117", "/health": "http://127.0.0.1:5117" } },
});
