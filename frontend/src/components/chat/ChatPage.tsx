import {useCallback} from 'react';
import type {AuthUser} from '../../context/AuthContext';
import {useAuth} from '../../hooks/useAuth';
import {useChat} from '../../hooks/useChat';
import {useChatSocket} from '../../hooks/useChatSocket';
import {useToast} from '../../hooks/useToast';
import ChatHeader from './ChatHeader';
import ChatWindow from './ChatWindow';
import Sidebar from './Sidebar';
import Toast from './Toast';

interface ChatPageProps {
    user: AuthUser;
}

export default function ChatPage({user}: ChatPageProps) {
    const {chatApi, logout} = useAuth();
    const {toast, showToast} = useToast();

    const {conversations, unread, activeUser, messages, receiveMessage, openConversation} =
        useChat({me: user.username, chatApi, onNotify: showToast});

    const {connected, send} = useChatSocket({token: user.token, onMessage: receiveMessage, onError: showToast});

    const handleSend = useCallback((content: string) => {
        if (!activeUser) return false;
        const sent = send(activeUser, content);
        if (!sent) showToast('Not connected, retrying…');
        return sent;
    }, [send, activeUser, showToast]);

    return (
        <div className="app">
            <ChatHeader user={user} connected={connected} onLogout={logout}/>

            <div className="main">
                <Sidebar
                    chatApi={chatApi}
                    conversations={conversations}
                    unread={unread}
                    activeUser={activeUser}
                    onSelect={openConversation}
                    onError={showToast}
                />
                <ChatWindow me={user.username} activeUser={activeUser} messages={messages} onSend={handleSend}/>
            </div>

            <Toast message={toast}/>
        </div>
    );
}
