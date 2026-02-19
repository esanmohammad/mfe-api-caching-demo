import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'demoCrossResource',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.tsx' },
      remotes: {
        demoCrUsers: 'http://localhost:4008/assets/remoteEntry.js',
        demoCrOrders: 'http://localhost:4009/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-redux', '@reduxjs/toolkit', '@dtsl/rtk-query'],
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 4006, strictPort: true },
  preview: { port: 4006, strictPort: true },
  build: { modulePreload: false, target: 'esnext', minify: false, cssCodeSplit: false },
});
