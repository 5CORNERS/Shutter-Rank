import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Fix: __dirname is not available in ES modules, so we define it manually.
const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.js.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'migration-tool': resolve(__dirname, 'migration-tool.html'),
      },
    },
  },
})