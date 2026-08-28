import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Expose SHOW_PLACEHOLDER (no VITE_ prefix) to client code via import.meta.env.
  envPrefix: ['VITE_', 'SHOW_PLACEHOLDER'],
})
