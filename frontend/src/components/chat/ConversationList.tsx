import type {UnreadCounts} from '../../hooks/useChat';
import type {Conversation} from '../../types/api';
import {cx} from '../../utils/classNames';
import {type ChatTarget, conversationTarget, targetKey} from '../../utils/conversation';

interface ConversationListProps {
    conversations: Conversation[];
    unread: UnreadCounts;
    active: ChatTarget | null;
    onSelect: (target: ChatTarget) => void;
}

function preview(c: Conversation): string {
    if (c.type === 'direct') return c.lastMessage ?? '';
    if (c.lastMessage === null) return 'No messages yet';
    return `@${c.lastSender}: ${c.lastMessage}`;
}

export default function ConversationList({conversations, unread, active, onSelect}: ConversationListProps) {
    const activeKey = active && targetKey(active);
    return (
        <ul className="list">
            {conversations.length === 0 && <li className="muted">No conversations yet</li>}
            {conversations.map((c) => {
                const target = conversationTarget(c);
                const key = targetKey(target);
                const unreadCount = unread[key] ?? 0;
                return (
                    <li
                        key={key}
                        className={cx(key === activeKey && 'active')}
                        onClick={() => onSelect(target)}
                    >
                        <div className="who">
                            <b>{c.type === 'direct' ? `@${c.username}` : `# ${c.name}`}</b>
                            <small>{preview(c)}</small>
                        </div>
                        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                    </li>
                );
            })}
        </ul>
    );
}
