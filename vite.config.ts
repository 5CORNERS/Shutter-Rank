import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Fix: __dirname is not available in ES modules, so we define it manually.
const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.js.dev/config/
export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');

    return {
        base: './',
        plugins: [react()],
        publicDir: 'public',
        // Define process.env.API_KEY globally for the app code
        define: {
            'process.env.API_KEY': JSON.stringify(env.API_KEY),
        },
        build: {
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html'),
                    'migration-tool': resolve(__dirname, 'migration-tool.html'),
                    'admin': resolve(__dirname, 'admin.html'),
                    'editor': resolve(__dirname, 'editor.html'),
                    'prepare': resolve(__dirname, 'prepare.html'),
                    'recalc': resolve(__dirname, 'recalc.html'),
                },
            },
        },
    }
})