import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const BACKEND_URL = 'http://localhost:8080';

// In development the Vite dev server proxies /api and /ws to Spring Boot,
// so the browser sees a single origin (no CORS needed while developing).
// The Origin header is rewritten too, so opening the app via a LAN IP isn't rejected by the CORS/WebSocket origin checks.
//
// basicSsl() serves the dev server over HTTPS with a self-signed certificate. Browsers only expose
// Web Crypto (crypto.subtle, needed for the E2EE key backup) in a secure context: HTTPS or localhost.
export default defineConfig({
    plugins: [react(), basicSsl()],
    server: {
        host: true, // listen on all interfaces, so other devices on the network can connect
        port: 5173,
        proxy: {
            '/api': {target: BACKEND_URL, changeOrigin: true, headers: {origin: BACKEND_URL}},
            '/ws': {target: BACKEND_URL, ws: true, changeOrigin: true, headers: {origin: BACKEND_URL}}
        }
    }
});