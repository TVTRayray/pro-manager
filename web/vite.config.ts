import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isDev = process.env.TAURI_DEBUG === 'true'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !isDev,
    sourcemap: isDev,
  },
})
