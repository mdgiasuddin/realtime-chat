import type {UnreadCounts} from '../../hooks/useChat';
import type {Conversation} from '../../types/api';
import {cx} from '../../utils/classNames';

interface ConversationListProps {
    conversations: Conversation[];
    unread: UnreadCounts;
    activeUser: string | null;
    onSelect: (username: string) => void;
}

export default function ConversationList({conversations, unread, activeUser, onSelect}: ConversationListProps) {
    return (
        <ul className="list">
            {conversations.length === 0 && <li className="muted">No conversations yet</li>}
            {conversations.map((c) => {
                const unreadCount = unread[c.username] ?? 0;
                return (
                    <li
                        key={c.username}
                        className={cx(c.username === activeUser && 'active')}
                        onClick={() => onSelect(c.username)}
                    >
                        <div className="who">
                            <b>@{c.username}</b>
                            <small>{c.lastMessage}</small>
                        </div>
                        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                    </li>
                );
            })}
        </ul>
    );
}
