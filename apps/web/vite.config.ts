import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { securityHeadersPlugin } from './security-headers'

export default defineConfig({
  plugins: [vue(), tailwindcss(), securityHeadersPlugin()],
  // Fixed port so the API's CORS setting can point at it.
  server: { port: 5173, strictPort: true },
})
