import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "demoHost",
      remotes: {
        demoListDelete: "http://localhost:4001/assets/remoteEntry.js",
        demoListAdd: "http://localhost:4002/assets/remoteEntry.js",
        demoListUpdate: "http://localhost:4003/assets/remoteEntry.js",
        demoCrUsers: "http://localhost:4008/assets/remoteEntry.js",
        demoCrOrders: "http://localhost:4009/assets/remoteEntry.js",
        demoTbUsers: "http://localhost:4010/assets/remoteEntry.js",
        demoTbOrders: "http://localhost:4011/assets/remoteEntry.js",
      },
      shared: [
        "react",
        "react-dom",
        "react-redux",
        "@reduxjs/toolkit",
        "@dtsl/rtk-query",
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 4005,
    strictPort: true,
  },
  preview: {
    port: 4005,
    strictPort: true,
  },
  build: {
    modulePreload: false,
    target: "esnext",
    minify: false,
    cssCodeSplit: false,
  },
});
