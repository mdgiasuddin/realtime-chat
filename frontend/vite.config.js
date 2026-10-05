import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// In development the Vite dev server proxies /api and /ws to Spring Boot,
// so the browser sees a single origin (no CORS needed while developing).
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {target: 'http://localhost:8080', changeOrigin: true},
            '/ws': {target: 'http://localhost:8080', ws: true, changeOrigin: true}
        }
    }
});
