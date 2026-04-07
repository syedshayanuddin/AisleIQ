import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // This is the same as the --host flag
    allowedHosts: [
      'syeds-macbook-air.local',
      'localhost',
      '.local' // This covers any local network address
    ]
  }
})