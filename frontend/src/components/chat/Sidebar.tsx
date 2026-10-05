import type {ChatApi} from '../../api/endpoints';
import type {UnreadCounts} from '../../hooks/useChat';
import type {Conversation} from '../../types/api';
import ConversationList from './ConversationList';
import UserSearch from './UserSearch';

interface SidebarProps {
    chatApi: ChatApi;
    conversations: Conversation[];
    unread: UnreadCounts;
    activeUser: string | null;
    onSelect: (username: string) => void;
    onError: (message: string) => void;
}

export default function Sidebar({chatApi, conversations, unread, activeUser, onSelect, onError}: SidebarProps) {
    return (
        <aside>
            <UserSearch chatApi={chatApi} onSelect={onSelect} onError={onError}/>

            <h3>Conversations</h3>
            <ConversationList
                conversations={conversations}
                unread={unread}
                activeUser={activeUser}
                onSelect={onSelect}
            />
        </aside>
    );
}
