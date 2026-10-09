import type {ChatApi} from '../../api/endpoints';
import type {UnreadCounts} from '../../hooks/useChat';
import type {Conversation} from '../../types/api';
import type {ChatTarget} from '../../utils/conversation';
import ConversationList from './ConversationList';
import UserSearch from './UserSearch';

interface SidebarProps {
    chatApi: ChatApi;
    conversations: Conversation[];
    unread: UnreadCounts;
    active: ChatTarget | null;
    onSelect: (target: ChatTarget) => void;
    onNewGroup: () => void;
    onError: (message: string) => void;
}

export default function Sidebar({chatApi, conversations, unread, active, onSelect, onNewGroup, onError}: SidebarProps) {
    return (
        <aside>
            <UserSearch
                chatApi={chatApi}
                onSelect={(username) => onSelect({type: 'direct', username})}
                onError={onError}
            />

            <div className="aside-head">
                <h3>Conversations</h3>
                <button type="button" className="small" onClick={onNewGroup}>+ New group</button>
            </div>
            <ConversationList
                conversations={conversations}
                unread={unread}
                active={active}
                onSelect={onSelect}
            />
        </aside>
    );
}
