import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'demoTagBased',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.tsx' },
      remotes: {
        demoTbUsers: 'http://localhost:4010/assets/remoteEntry.js',
        demoTbOrders: 'http://localhost:4011/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-redux', '@reduxjs/toolkit', '@dtsl/rtk-query'],
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 4007, strictPort: true },
  preview: { port: 4007, strictPort: true },
  build: { modulePreload: false, target: 'esnext', minify: false, cssCodeSplit: false },
});
