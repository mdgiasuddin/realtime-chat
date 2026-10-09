import {useState} from 'react';
import type {ChatApi} from '../../api/endpoints';
import {useUserSearch} from '../../hooks/useUserSearch';
import type {UserSummary} from '../../types/api';

interface MemberPickerProps {
    chatApi: ChatApi;
    selected: UserSummary[];
    /** Usernames that can't be picked (e.g. existing members). */
    exclude: string[];
    onChange: (selected: UserSummary[]) => void;
    onError: (message: string) => void;
}

/** User search + chips for picking several users. */
export default function MemberPicker({chatApi, selected, exclude, onChange, onError}: MemberPickerProps) {
    const [query, setQuery] = useState('');
    const results = useUserSearch(query, chatApi, onError);
    const taken = new Set([...exclude, ...selected.map((u) => u.username)]);
    const available = results.filter((u) => !taken.has(u.username));

    const add = (user: UserSummary) => {
        setQuery('');
        onChange([...selected, user]);
    };

    return (
        <>
            {selected.length > 0 && (
                <div className="chips">
                    {selected.map((u) => (
                        <span key={u.id} className="chip">
                            @{u.username}
                            <button
                                type="button"
                                aria-label={`Remove @${u.username}`}
                                onClick={() => onChange(selected.filter((s) => s.id !== u.id))}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <input
                placeholder="Search users to add…"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            {query.trim() !== '' && (
                <ul className="list">
                    {available.length === 0 && <li className="muted">No users found</li>}
                    {available.map((u) => (
                        <li key={u.id} onClick={() => add(u)}>
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
