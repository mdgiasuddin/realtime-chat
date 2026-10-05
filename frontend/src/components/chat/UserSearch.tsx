import {useState} from 'react';
import type {ChatApi} from '../../api/endpoints';
import {useUserSearch} from '../../hooks/useUserSearch';

interface UserSearchProps {
    chatApi: ChatApi;
    onSelect: (username: string) => void;
    onError: (message: string) => void;
}

export default function UserSearch({chatApi, onSelect, onError}: UserSearchProps) {
    const [query, setQuery] = useState('');
    const results = useUserSearch(query, chatApi, onError);
    const searching = query.trim() !== '';

    const pick = (username: string) => {
        setQuery('');
        onSelect(username);
    };

    return (
        <>
            <input
                placeholder="Search users by username…"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            {searching && (
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
        </>
    );
}
