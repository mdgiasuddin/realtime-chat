import {useEffect, useState} from 'react';

export default function Sidebar({api, convos, unread, active, onSelect, onError}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    // Debounced user search
    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setResults([]);
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const found = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
                if (!cancelled) setResults(found);
            } catch (err) {
                onError(err.message);
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, api, onError]);

    const pick = (username) => {
        setQuery('');
        setResults([]);
        onSelect(username);
    };

    return (
        <aside>
            <input
                placeholder="Search users by username…"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            {query.trim() && (
                <ul className="list">
                    {results.length === 0 && <li className="muted">No users found</li>}
                    {results.map((u) => (
                        <li key={u.id} onClick={() => pick(u.username)}>
                            <div className="who">
                                <b>{u.name}</b>
                                <small>@{u.username}</small>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <h3>Conversations</h3>
            <ul className="list">
                {convos.length === 0 && <li className="muted">No conversations yet</li>}
                {convos.map((c) => (
                    <li
                        key={c.username}
                        className={c.username === active ? 'active' : ''}
                        onClick={() => onSelect(c.username)}
                    >
                        <div className="who">
                            <b>@{c.username}</b>
                            <small>{c.lastMessage}</small>
                        </div>
                        {unread[c.username] > 0 && <span className="badge">{unread[c.username]}</span>}
                    </li>
                ))}
            </ul>
        </aside>
    );
}
