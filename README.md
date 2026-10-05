# Real-Time Chat: Spring Boot backend + React frontend

```
realtime-chat/
├── backend/    Spring Boot 3 (REST + STOMP WebSocket + JWT + JPA)
└── frontend/   React 18 + Vite (@stomp/stompjs)
```

## Run in development

Terminal 1 (backend, port 8080):

```bash
cd backend
mvn spring-boot:run
```

Terminal 2 (frontend, port 5173):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in two tabs (or one normal + one private window), register `alice` in one and `bob` in the
other, search for each other and chat.

In development the Vite dev server proxies `/api` and `/ws` to `localhost:8080`, so the browser only talks to one
origin.

## Deploying (frontend on a different origin than the API)

1. Build the frontend with the API address baked in:
   ```bash
   cd frontend
   echo "VITE_API_URL=https://api.example.com" > .env.production
   npm run build            # static files in frontend/dist
   ```
2. Host `frontend/dist` on any static host (Nginx, S3 + CloudFront, Netlify, ...).
3. Allow that origin on the backend:
   ```bash
   export CORS_ORIGINS=https://chat.example.com
   export JWT_SECRET=$(openssl rand -base64 32)
   ```
   This list is used for both REST CORS and the WebSocket handshake.

Alternative: serve `dist` and proxy `/api` and `/ws` (with WebSocket upgrade) from the same domain via Nginx, leave
`VITE_API_URL` empty, and no CORS is needed.

## Frontend structure

```
frontend/src
├── main.jsx                  entry, wraps <App/> in <AuthProvider>
├── App.jsx                   login page or chat page depending on auth state
├── api.js                    fetch wrapper (JWT header, error handling) + WebSocket URL
├── context/AuthContext.jsx   login / register / logout, token in sessionStorage, authenticated api()
├── hooks/useChatSocket.js    STOMP connection with JWT, subscribe, send, auto-reconnect
└── components/
    ├── AuthPage.jsx          login + register forms
    ├── ChatPage.jsx          state: conversations, unread, active chat, messages, toast
    ├── Sidebar.jsx           debounced user search + conversation list
    └── ChatWindow.jsx        message bubbles + input
```
