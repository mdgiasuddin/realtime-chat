import {useCallback, useEffect, useRef, useState} from 'react';
import {useAuth} from '../context/AuthContext.jsx';
import {useChatSocket} from '../hooks/useChatSocket.js';
import Sidebar from './Sidebar.jsx';
import ChatWindow from './ChatWindow.jsx';

export default function ChatPage() {
    const {user, token, api, logout} = useAuth();

    const [convos, setConvos] = useState([]);   // [{ username, lastMessage, lastSentAt }]
    const [unread, setUnread] = useState({});   // { username: count }
    const [active, setActive] = useState(null); // username of the open chat
    const [messages, setMessages] = useState([]);
    const [toast, setToast] = useState(null);

    const activeRef = useRef(null);             // lets the socket callback read the current chat
    const toastTimer = useRef(null);

    const showToast = useCallback((msg) => {
        setToast(msg);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    /* ----- incoming (and echoed) messages from the WebSocket ----- */
    const handleIncoming = useCallback((m) => {
        const other = m.sender === user.username ? m.receiver : m.sender;

        setConvos((prev) => [
            {username: other, lastMessage: m.content, lastSentAt: m.sentAt},
            ...prev.filter((c) => c.username !== other)
        ]);

        if (activeRef.current === other) {
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        } else if (m.sender !== user.username) {
            setUnread((prev) => ({...prev, [other]: (prev[other] || 0) + 1}));
            showToast(`New message from @${m.sender}`);
        }
    }, [user.username, showToast]);

    const {connected, send} = useChatSocket(token, handleIncoming, showToast);

    /* ----- load conversation list once ----- */
    useEffect(() => {
        api('/api/messages/conversations').then(setConvos).catch((e) => showToast(e.message));
    }, [api, showToast]);

    /* ----- open a conversation + load its history ----- */
    const selectUser = useCallback(async (username) => {
        activeRef.current = username;
        setActive(username);
        setMessages([]);
        setUnread((prev) => ({...prev, [username]: 0}));
        try {
            const page = await api(`/api/messages/${encodeURIComponent(username)}?page=0&size=50`);
            if (activeRef.current !== username) return; // user switched chats while loading
            const history = [...page].reverse();        // API returns newest first
            setMessages((prev) => {
                const ids = new Set(history.map((m) => m.id));
                return [...history, ...prev.filter((m) => !ids.has(m.id))];
            });
        } catch (err) {
            showToast(err.message);
        }
    }, [api, showToast]);

    const handleSend = useCallback((content) => {
        const ok = send(active, content);
        if (!ok) showToast('Not connected, retrying…');
        return ok;
    }, [send, active, showToast]);

    return (
        <div className="app">
            <header>
                <div>
                    <strong>{user.name}</strong> <span className="muted">@{user.username}</span>
                </div>
                <div className="right">
          <span
              className={`dot ${connected ? 'on' : 'off'}`}
              title={connected ? 'connected' : 'disconnected'}
          />
                    <button type="button" onClick={logout}>Logout</button>
                </div>
            </header>

            <div className="main">
                <Sidebar
                    api={api}
                    convos={convos}
                    unread={unread}
                    active={active}
                    onSelect={selectUser}
                    onError={showToast}
                />
                <ChatWindow me={user.username} active={active} messages={messages} onSend={handleSend}/>
            </div>

            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}
