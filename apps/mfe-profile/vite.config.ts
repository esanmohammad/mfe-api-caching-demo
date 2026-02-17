import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'mfeProfile',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
        './UserCard': './src/components/UserCard.tsx',
      },
      shared: ['react', 'react-dom', 'react-redux', '@reduxjs/toolkit', '@dtsl/rtk-query'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
  },
  preview: {
    port: 3002,
    strictPort: true,
  },
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
});
