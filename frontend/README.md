# Real-Time Chat: Frontend (React + TypeScript + Vite)

Features

- Login / register against the Spring Boot API; the JWT is kept in `sessionStorage` (per tab)
- Debounced user search, conversation list with unread badges
- Real-time messaging over STOMP/WebSocket with auto-reconnect
- Paged history when a conversation is opened, merged with live messages
- Toast notifications for new messages in other chats and for errors

Stack: React 19, TypeScript 7 (strict), Vite 8, `@stomp/stompjs` 7. No router, no state library: React state +
one context is enough for this app.

## Requirements

- Node `^20.19.0 || >=22.12.0` (required by Vite 8)
- The backend running on `localhost:8080` (see `../backend/README.md`)

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script              | What it does                                            |
|---------------------|---------------------------------------------------------|
| `npm run dev`       | Vite dev server with hot reload                         |
| `npm run typecheck` | `tsc -b`: type-checks app + `vite.config.ts`, no output |
| `npm run build`     | type-check, then bundle into `dist/`                    |
| `npm run preview`   | serve `dist/` locally                                   |

Tip: open two tabs (or a normal + private window) and log in as different users; `sessionStorage` keeps each tab's
session separate.

## Configuration

| Setting               | How                                                                                                              |
|-----------------------|------------------------------------------------------------------------------------------------------------------|
| Backend origin (prod) | `VITE_API_URL=https://api.example.com` in `.env.production` **before** `npm run build` (see `.env.example`)      |
| Backend origin (dev)  | leave `VITE_API_URL` empty; `vite.config.ts` proxies `/api` and `/ws` to `BACKEND_URL` (`http://localhost:8080`) |

With `VITE_API_URL` empty, every request goes to the page's own origin, so the WebSocket URL becomes
`ws(s)://<current host>/ws`. With it set, `http` is swapped for `ws` (`https` -> `wss`).

## Project layout

```
src
├── main.tsx                 entry: <StrictMode><AuthProvider><App/></AuthProvider></StrictMode>
├── App.tsx                  AuthPage or ChatPage, depending on whether a user is logged in
├── index.css                all styles (plain CSS, class names used by the components below)
├── vite-env.d.ts            typing for import.meta.env.VITE_API_URL
├── types/
│   └── api.ts               wire types mirroring the backend DTOs
├── api/
│   ├── client.ts            request<T>() fetch wrapper, ApiError, wsUrl()
│   └── endpoints.ts         authApi (public) + createChatApi() (JWT-bound)
├── context/
│   ├── AuthContext.ts       the context object + AuthContextValue / AuthUser types
│   └── AuthProvider.tsx     owns the logged-in user; login / register / logout; builds chatApi
├── hooks/
│   ├── useAuth.ts           reads AuthContext (throws outside the provider)
│   ├── useChat.ts           conversations, unread counts, open chat, its messages
│   ├── useChatSocket.ts     STOMP connection: subscribe, send, reconnect
│   ├── useUserSearch.ts     debounced + abortable user search
│   └── useToast.ts          one auto-dismissing toast
├── utils/
│   ├── classNames.ts        cx('a', cond && 'b') -> "a b"
│   ├── errors.ts            getErrorMessage(unknown) -> string
│   └── format.ts            formatTime(iso) -> "14:05"
└── components/
    ├── auth/
    │   ├── AuthPage.tsx     tabs, busy flag, error line
    │   ├── LoginForm.tsx
    │   └── RegisterForm.tsx
    └── chat/
        ├── ChatPage.tsx     wires hooks to the chat UI
        ├── ChatHeader.tsx
        ├── Sidebar.tsx
        ├── UserSearch.tsx
        ├── ConversationList.tsx
        ├── ChatWindow.tsx
        ├── MessageBubble.tsx
        ├── MessageComposer.tsx
        └── Toast.tsx
```

## Architecture

The code is layered; each layer only imports from the layers below it.

```
components/   UI: render props, keep only local UI state (form inputs, search text)
    │
hooks/        stateful logic: chat state, socket, search, toast   ◄── context/  (auth state + chatApi)
    │                                                                   │
api/          HTTP + WebSocket URL; no React                       ◄────┘
    │
types/        plain TypeScript interfaces matching the backend
```

Two rules keep the data flow easy to follow:

1. **State lives in one place, data flows down as props, changes flow up as callbacks.** No component reaches into
   another's state. Components only receive what they render plus `on…` callbacks.
2. **Only the three page-level components touch the context.** `App` reads `user`; `AuthPage` reads `login` /
   `register`; `ChatPage` reads `chatApi` / `logout`. Everything below them gets data through props, so they can be
   read (and tested) on their own.

### Component tree and props

```
<AuthProvider>                                   context: { user, login, register, logout, chatApi }
└── <App>                                        useAuth() -> user
    ├── <AuthPage>               (user == null)  useAuth() -> login, register
    │   ├── <LoginForm    busy onSubmit(credentials)>
    │   └── <RegisterForm busy onSubmit(registerRequest)>
    │
    └── <ChatPage user>          (user != null)  useAuth() -> chatApi, logout
        │                                        useToast(), useChat(), useChatSocket()
        ├── <ChatHeader user connected onLogout>
        ├── <Sidebar chatApi conversations unread activeUser onSelect onError>
        │   ├── <UserSearch chatApi onSelect onError>          useUserSearch()
        │   └── <ConversationList conversations unread activeUser onSelect>
        ├── <ChatWindow me activeUser messages onSend>
        │   ├── <MessageBubble message mine>  × messages.length
        │   └── <MessageComposer disabled onSend>
        └── <Toast message>
```

### Who owns which state

| State                                               | Owner                                            | Read by                                            |
|-----------------------------------------------------|--------------------------------------------------|----------------------------------------------------|
| logged-in user `{token, username, name}`            | `AuthProvider` (+ sessionStorage)                | `App` -> `ChatPage` -> `ChatHeader`, hooks         |
| `chatApi` (endpoints bound to the token)            | `AuthProvider` (memoized on token)               | `ChatPage` -> `useChat`, `Sidebar` -> `UserSearch` |
| `conversations`, `unread`, `activeUser`, `messages` | `useChat` (in `ChatPage`)                        | `Sidebar`, `ConversationList`, `ChatWindow`        |
| socket `connected`                                  | `useChatSocket` (in `ChatPage`)                  | `ChatHeader` (green / red dot)                     |
| `toast`                                             | `useToast` (in `ChatPage`)                       | `Toast`                                            |
| active auth tab, `busy`, `error`                    | `AuthPage`                                       | `LoginForm`, `RegisterForm`                        |
| form field values                                   | `LoginForm` / `RegisterForm` / `MessageComposer` | themselves                                         |
| search `query` / `results`                          | `UserSearch` / `useUserSearch`                   | `UserSearch`                                       |

`showToast` from `useToast` is the app's single error/notification sink: it is passed as `onNotify` to `useChat`,
`onError` to `useChatSocket` and `Sidebar` -> `UserSearch`.

## Data flows

### 1. App start / session restore

```
main.tsx ─► AuthProvider: useState(loadStoredUser)   reads sessionStorage['chat-auth']
                │
                ├─ found  ─► user = {token, username, name} ─► App renders <ChatPage user>
                └─ absent ─► user = null                    ─► App renders <AuthPage>
```

A refresh in the same tab keeps you logged in; a new tab starts logged out. The token is not validated up front: if
it has expired, the first REST call returns 401 and triggers logout (flow 8).

### 2. Login and register

```
LoginForm ──onSubmit({username, password})──► AuthPage.run(() => login(credentials))
                                                 │   busy = true, error = ''
                                                 ▼
                    AuthProvider.login ──► authApi.login ──► POST /api/auth/login
                                                 │
                                    ◄── {token, username, name}
                                                 │
                    sessionStorage.setItem(...) + setUser(...)
                                                 │
                    App re-renders ──► <ChatPage user>   (AuthPage unmounts)

  on failure: ApiError(message from {"error": "..."}) ──► AuthPage shows it in .error, busy = false
```

`RegisterForm` turns its all-string form into a `RegisterRequest` (trimmed; empty optional fields become `null`), then
`AuthProvider.register` calls `POST /api/auth/register` and, on success, `login()` with the same credentials. So a
successful registration lands directly in the chat.

### 3. Entering the chat

When `ChatPage` mounts, two things start in parallel:

```
useChat     effect ──► chatApi.getConversations() ──► GET /api/messages/conversations ──► conversations
useChatSocket effect ──► new STOMP Client(wsUrl(), Authorization: Bearer <token>).activate()
                             onConnect ──► connected = true
                                         ├─ subscribe /user/queue/messages ──► receiveMessage (flow 6)
                                         └─ subscribe /user/queue/errors   ──► showToast(error)
```

In development `StrictMode` runs effects twice, so you will see the conversation request twice and the socket
connect, disconnect, and connect again. This is expected and does not happen in production builds.

### 4. Searching for a user

```
UserSearch input ──► query ──► useUserSearch(query, chatApi, onError)
                                 │  q = query.trim(); empty -> results = []
                                 │  300 ms debounce (timer reset on every keystroke)
                                 ▼
                       chatApi.searchUsers(q, abortSignal) ──► GET /api/users/search?q=...
                                 │
                       results ──► <ul> of matches
```

When the query changes before the previous request finishes, the old request is **aborted** (not just ignored), and
the abort error is not shown as a toast. Clicking a result clears the query and calls `onSelect(username)`, the same
callback the conversation list uses (flow 5).

### 5. Opening a conversation

`onSelect` in both `UserSearch` and `ConversationList` is `useChat.openConversation`:

```
openConversation('bob')
  ├─ activeRef = 'bob', activeUser = 'bob'     ChatWindow title becomes "@bob", composer enabled
  ├─ messages = []                             old chat cleared immediately
  ├─ unread['bob'] = 0                         badge disappears
  └─ chatApi.getHistory('bob', 0, 50) ──► GET /api/messages/bob?page=0&size=50   (newest first)
         │
         ├─ if activeRef !== 'bob' anymore ──► drop the result (user clicked another chat meanwhile)
         └─ messages = mergeHistory(history reversed to oldest-first, messages that arrived live meanwhile)
```

`activeRef` mirrors `activeUser` in a ref so that async code (this request, socket callbacks) always sees the *current*
chat rather than the value captured when the callback was created. `mergeHistory` deduplicates by message
`id`, so a message that arrived over the socket during loading is not shown twice.

After `messages` or `activeUser` change, `ChatWindow` scrolls to the bottom.

### 6. Sending and receiving messages

The server echoes every message you send back to you on `/user/queue/messages`. So both directions go through the
same handler; the UI never adds a message optimistically.

```
MessageComposer submit
  │ content = text.trim(); empty -> ignored
  ▼
ChatPage.handleSend(content) ──► useChatSocket.send(activeUser, content)
  │                                 │ not connected -> return false
  │                                 └ publish /app/chat.send {to, content} -> return true
  │
  ├─ true  ──► MessageComposer clears the input
  └─ false ──► showToast('Not connected, retrying…'); input keeps the text so you can resend

                         ─── server persists & delivers ───

/user/queue/messages frame (to receiver AND sender)
  ▼
useChatSocket ──► useChat.receiveMessage(message)
  │ other = the participant who isn't me
  ├─ conversations: move/insert `other` at the top with this message as preview
  ├─ if other is the open chat ──► append to messages (skip if id already present)
  └─ else if I'm not the sender ──► unread[other] += 1, showToast('New message from @other')
```

Server-side errors (e.g. "Recipient not found", "You cannot message yourself") come back on `/user/queue/errors` and are
shown as a toast.

### 7. Connection loss

On socket close `connected` becomes `false` (red dot in `ChatHeader`). The STOMP client retries every 5 s
(`RECONNECT_DELAY_MS`) and re-subscribes in `onConnect`. While disconnected `send` returns `false` (flow 6). Messages
sent to you while you were offline are not replayed over the socket; they appear when you reopen that conversation
(history is loaded via REST).

### 8. Errors and session expiry

```
any chatApi call ──► request<T>(path, {token, onUnauthorized: logout})
  ├─ 401 ──► logout() ──► user = null ──► App shows AuthPage
  ├─ other non-2xx ──► throw ApiError(body.error ?? 'Request failed (status)')
  └─ caller catches ──► getErrorMessage(err) ──► showToast / AuthPage error line
```

### 9. Logout

`ChatHeader` button ──► `logout()` ──► `sessionStorage` cleared, `user = null` ──► `App` renders `AuthPage` ──►
`ChatPage` unmounts ──► `useChatSocket` cleanup calls `client.deactivate()`; the toast timer is cleared. All chat
state lived inside `ChatPage`'s hooks, so it is discarded; the next login starts clean.

## Module reference

### Entry

- **`main.tsx`**: mounts the app into `#root` inside `StrictMode` and `AuthProvider`; fails loudly if `#root` is
  missing.
- **`App.tsx`**: the only "router". Passes the non-null `user` down as a prop, so `ChatPage` and below never have to
  handle "not logged in".

### `api/`

- **`client.ts`**
    - `request<T>(path, {method, body, token, onUnauthorized, signal})`: JSON in/out, adds `Authorization: Bearer`.
      Throws `ApiError` (with `status`) on non-2xx, using the backend's `{"error": "..."}` message when present. A
      401 on an *authenticated* call calls `onUnauthorized` (a 401 from login just means wrong password).
    - `wsUrl()`: the STOMP endpoint URL (see Configuration).
- **`endpoints.ts`**: the only place that knows URL paths.
    - `authApi.login` / `authApi.register`: public endpoints.
    - `createChatApi(authed)`: `searchUsers`, `getConversations`, `getHistory`. `authed` is a `request` with the
      token and `onUnauthorized` already filled in, so callers never deal with tokens.
    - `ChatApi` type: `ReturnType<typeof createChatApi>`, so it stays in sync automatically.

### `context/`

- **`AuthContext.ts`**: `AuthContext` and its value type. Kept separate from the provider so the provider file only
  exports a component (better hot reload).
- **`AuthProvider.tsx`**: owns `user`. `login`, `register`, `logout` are `useCallback`s; `chatApi` is rebuilt only
  when the token changes; the context value is memoized so consumers don't re-render needlessly.

### `hooks/`

- **`useAuth()`**: `use(AuthContext)` with a clear error when used outside `<AuthProvider>`.
- **`useChat({me, chatApi, onNotify})`**: chat state, see flows 3, 5, 6. Returns
  `{conversations, unread, activeUser, messages, receiveMessage, openConversation}`. The pure helpers
  `bumpConversation` and `mergeHistory` at the top of the file hold the list logic.
- **`useChatSocket({token, onMessage, onError})`**: returns `{connected, send(to, content): boolean}`. The socket is
  created once per token. `onMessage` / `onError` are wrapped in `useEffectEvent`, so passing new callbacks on
  re-render never reconnects. STOMP destinations are in the `Destinations` constant.
- **`useUserSearch(query, chatApi, onError)`**: returns the matching `UserSummary[]`, see flow 4.
- **`useToast()`**: `{toast, showToast}`; one message at a time, a new one replaces the old and restarts the
  3.5 s timer. `showToast` is stable, so it's safe in dependency arrays.

### `components/auth/`

- **`AuthPage`**: Login / Register tabs (switching clears the error). `run(action)` wraps a submit: sets `busy`,
  clears and then sets `error`. The forms don't know about the context; they only report what was submitted.
- **`LoginForm`**: username + password; trims the username.
- **`RegisterForm`**: name, username (min 3), password (min 6), optional email / phone / bio. `toRegisterRequest`
  converts form strings to the API shape. Browser validation (`required`, `minLength`, `type="email"`) runs first;
  the backend's validation message is shown if it rejects the data.

  Each form keeps its own field state, so switching tabs resets the form you leave.

### `components/chat/`

- **`ChatPage`**: the composition root of the chat: calls `useToast`, `useChat`, `useChatSocket`, and passes their
  outputs down. `handleSend` ties the open chat (`activeUser`) to `socket.send`.
- **`ChatHeader`**: name, `@username`, connection dot (`.dot.on` / `.dot.off`), Logout button.
- **`Sidebar`**: layout only: `UserSearch` above, "Conversations" heading, `ConversationList` below.
- **`UserSearch`**: the search box and results list; owns `query`. Results are only shown while the query is
  non-empty.
- **`ConversationList`**: one row per conversation partner with last-message preview, unread badge, and the
  `.active` highlight for the open chat.
- **`ChatWindow`**: title, message list and composer; auto-scrolls to the newest message. `mine` (sender is me)
  decides the bubble side.
- **`MessageBubble`**: content + local time (`<time dateTime>` keeps the exact timestamp).
- **`MessageComposer`**: owns the input text; `maxLength` matches the backend's 2000-character limit. Clears the
  input only when `onSend` returns `true`.
- **`Toast`**: renders nothing when there is no message; `role="status"` so screen readers announce it.

## Conventions

- Types for anything crossing the network live in `types/api.ts` and follow the backend DTO names (`ChatMessageDto` ->
  `ChatMessage`, `ConversationDto` -> `Conversation`).
- Catch errors as `unknown` and turn them into text with `getErrorMessage`.
- Components get data via props; only page-level components (`App`, `AuthPage`, `ChatPage`) call `useAuth`.
- Named constants for tunables: `TOAST_DURATION_MS`, `DEBOUNCE_MS`, `HISTORY_PAGE_SIZE`, `RECONNECT_DELAY_MS`,
  `MAX_MESSAGE_LENGTH`.
- The TypeScript config is strict, including `noUncheckedIndexedAccess` (e.g. `unread[name]` is
  `number | undefined`, hence `?? 0`).

### Adding a REST call

1. Add the request/response interfaces to `types/api.ts`.
2. Add a method to `createChatApi` (or `authApi` if it's public) in `api/endpoints.ts`.
3. Call it from a hook (e.g. `useChat`), catch with `getErrorMessage` and report through `onNotify`.

### Adding a STOMP subscription

Add the destination to `Destinations` in `useChatSocket.ts`, subscribe in `onConnect`, and expose a new callback
option wrapped in `useEffectEvent`, the same way `onMessage` is.

## Going further

- Load older history on scroll (`getHistory` already takes `page`)
- Show online status (`GET /api/users/{username}/online` exists on the backend)
- Queue messages typed while disconnected instead of rejecting them
- Persist unread counts server-side; today they reset on reload
- Add tests (Vitest + React Testing Library); the pure helpers in `useChat.ts` and `RegisterForm.tsx` are easy
  starting points
