# Real-Time Chat (Spring Boot + WebSocket + JWT)

Features

- Register (name, username, password, email, phone, bio) and login -> JWT
- Search users by username (JWT-protected)
- Send messages over STOMP/WebSocket; the receiver gets them instantly if connected
- Messages are persisted; paged history + conversation list via REST
- API-only backend: the React app in `../frontend` is the UI

## Requirements

- Java 17+
- Maven 3.9+ (or import into IntelliJ / VS Code / Eclipse)

## Run

```bash
mvn spring-boot:run
```

Then start the React app from `../frontend` (see the root README).

## Configuration

| Setting                                      | How                                                                                                                      |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| JWT secret (Base64, >=32 bytes)              | `export JWT_SECRET=$(openssl rand -base64 32)`                                                                           |
| PostgreSQL instead of in-memory H2           | `--spring.profiles.active=postgres` with `DB_URL`, `DB_USER`, `DB_PASSWORD`                                              |
| Token lifetime                               | `app.jwt.expiration-ms` in `application.yml`                                                                             |
| Allowed front-end origins (CORS + WebSocket) | `export CORS_ORIGINS=https://chat.example.com` (comma-separated; default is the Vite dev server `http://localhost:5173`) |

The bundled `application.yml` contains a generated development secret. Do not reuse it in production.

## REST API

| Method | Path                                      | Auth | Description                                         |
|--------|-------------------------------------------|------|-----------------------------------------------------|
| POST   | `/api/auth/register`                      | no   | `{name, username, password, email?, phone?, bio?}`  |
| POST   | `/api/auth/login`                         | no   | `{username, password}` -> `{token, username, name}` |
| GET    | `/api/users/search?q=`                    | JWT  | find users by partial username                      |
| GET    | `/api/users/{username}/online`            | JWT  | is the user connected right now                     |
| GET    | `/api/messages/conversations`             | JWT  | chat partners, newest first                         |
| GET    | `/api/messages/{username}?page=0&size=30` | JWT  | history with a user, newest first                   |

Usernames are stored lowercase.

## WebSocket (STOMP)

- Endpoint: `ws://localhost:8080/ws`
- CONNECT header: `Authorization: Bearer <jwt>`
- Send: publish to `/app/chat.send` with `{"to":"bob","content":"hello"}`
- Receive: subscribe to `/user/queue/messages` (incoming and echoed outgoing messages)
- Errors: subscribe to `/user/queue/errors`

## curl quick test

```bash
curl -s -X POST localhost:8080/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Alice","username":"alice","password":"secret1"}'
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret1"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s "localhost:8080/api/users/search?q=bo" -H "Authorization: Bearer $TOKEN"
```

## Project layout

```
src/main/java/com/example/chat
  config/    SecurityConfig, WebSocketConfig
  security/  JwtService, JwtAuthFilter, JwtChannelInterceptor, AppUserDetailsService
  auth/      AuthController + DTOs
  user/      User, UserRepository, UserController
  message/   ChatMessage, repository, MessageService, ChatController (WS), MessageController (REST)
  common/    GlobalExceptionHandler
```

## Going further

- Multiple server instances: replace `enableSimpleBroker` with `enableStompBrokerRelay` (RabbitMQ STOMP plugin)
- Unread counts persisted server-side (add `readAt` to `ChatMessage`)
- Presence / typing indicators via `SessionConnectedEvent` / `SessionDisconnectEvent`
- Refresh tokens; lock down CORS and `setAllowedOriginPatterns` to your domain
- Flyway/Liquibase instead of `ddl-auto: update`
