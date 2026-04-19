import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const webhookProxy = {
  "/api/webhook-select-club": {
    target: "https://webhook.mrarbitragem.com.br",
    changeOrigin: true,
    secure: true,
    rewrite: () => "/webhook/select_club",
  },
  "/api/webhook-jogo": {
    target: "https://webhook.mrarbitragem.com.br",
    changeOrigin: true,
    secure: true,
    rewrite: () => "/webhook/jogo",
  },
  "/api/webhook-chave": {
    target: "https://webhook.mrarbitragem.com.br",
    changeOrigin: true,
    secure: true,
    rewrite: () => "/webhook/chave",
  },
  "/api/webhook-save-chave": {
    target: "https://webhook.mrarbitragem.com.br",
    changeOrigin: true,
    secure: true,
    rewrite: () => "/webhook/save_chave",
  },
} as const;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Mesma origem no dev → o browser não aplica CORS ao n8n (evita "Failed to fetch").
    proxy: { ...webhookProxy },
  },
  preview: {
    port: 8080,
    proxy: { ...webhookProxy },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
