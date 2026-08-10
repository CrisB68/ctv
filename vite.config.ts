import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" garante que os assets funcionem tanto no GitHub Pages
// quanto em qualquer outro host estático (ex: Vercel, Netlify).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
