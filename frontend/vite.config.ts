import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND_URL = 'http://localhost:8080';

// In development the Vite dev server proxies /api and /ws to Spring Boot,
// so the browser sees a single origin (no CORS needed while developing).
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {target: BACKEND_URL, changeOrigin: true},
            '/ws': {target: BACKEND_URL, ws: true, changeOrigin: true}
        }
    }
});
