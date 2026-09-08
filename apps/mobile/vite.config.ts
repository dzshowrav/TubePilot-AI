import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const require = createRequire(import.meta.url);
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react-native$/,
        replacement: require.resolve("react-native-web"),
      },
      {
        find: /^react-native-svg$/,
        replacement: join(
          dirname(require.resolve("react-native-svg/package.json")),
          "lib/module/elements.web.js",
        ),
      },
    ],
    extensions: [
      ".web.tsx",
      ".tsx",
      ".web.ts",
      ".ts",
      ".web.jsx",
      ".jsx",
      ".web.js",
      ".js",
      ".json",
    ],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
    "process.env.EXPO_OS": JSON.stringify("web"),
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: [".e2b.app"],
    proxy: { "/api": { target: "http://127.0.0.1:4000", changeOrigin: false } },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 900 },
});
