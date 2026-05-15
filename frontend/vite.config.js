import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    plugins: [
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
        }),
        react(),
        tailwindcss(),
    ],
    clearScreen: false,
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@bindings/services": fileURLToPath(new URL("./bindings/github.com/joaov/putch/internal/services/index.js", import.meta.url)),
        },
    },
    server: {
        strictPort: true,
    },
});
