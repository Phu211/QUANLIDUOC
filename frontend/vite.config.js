import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5139',
        changeOrigin: true,
        secure: false,
      },
      '/pharmacyHub': {
        target: 'http://localhost:5139',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
