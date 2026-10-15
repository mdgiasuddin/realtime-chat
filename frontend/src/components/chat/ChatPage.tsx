import {useCallback, useMemo, useState} from 'react';
import type {AuthUser} from '../../context/AuthContext';
import type {Identity} from '../../crypto/identity';
import {createMessageCipher} from '../../crypto/messageCipher';
import {useAuth} from '../../hooks/useAuth';
import {useChat} from '../../hooks/useChat';
import {useChatSocket} from '../../hooks/useChatSocket';
import {useToast} from '../../hooks/useToast';
import {getErrorMessage} from '../../utils/errors';
import ChatHeader from './ChatHeader';
import ChatWindow from './ChatWindow';
import GroupDialog from './GroupDialog';
import GroupSettingsDialog from './GroupSettingsDialog';
import Sidebar from './Sidebar';
import Toast from './Toast';

interface ChatPageProps {
    user: AuthUser;
    /** This device's E2EE key, unlocked by KeyGate. */
    identity: Identity;
}

export default function ChatPage({user, identity}: ChatPageProps) {
    const {chatApi, logout} = useAuth();
    const cipher = useMemo(
        () => createMessageCipher(user.username, identity, chatApi),
        [user.username, identity, chatApi]);
    const {toast, showToast} = useToast();
    /** Which group dialog is open, if any. */
    const [dialog, setDialog] = useState<'create' | 'add' | 'settings' | null>(null);

    const {
        conversations, unread, active, activeGroup, messages,
        receiveMessage, receiveGroupEvent, resync, openConversation,
        createGroup, addMembers, leaveGroup, renameGroup, removeMember, setAdmin, deleteGroup
    } = useChat({me: user.username, chatApi, cipher, onNotify: showToast});

    const {connected, send} = useChatSocket({
        token: user.token,
        onMessage: receiveMessage,
        onGroupEvent: receiveGroupEvent,
        onReconnect: resync,
        onError: showToast
    });

    /** Encrypts for everyone in the open chat, then sends. Only the ciphertext reaches the server. */
    const handleSend = useCallback(async (content: string) => {
        const target = active;
        if (!target) return false;
        if (target.type === 'group' && !activeGroup) {
            showToast('Still loading the group members…');
            return false;
        }
        let envelope: string;
        try {
            envelope = await cipher.encrypt(target, content, activeGroup?.members.map((m) => m.username) ?? []);
        } catch (err) {
            showToast(getErrorMessage(err));
            return false;
        }
        const sent = send(target, envelope);
        if (!sent) showToast('Not connected, retrying…');
        return sent;
    }, [send, active, activeGroup, cipher, showToast]);

    const handleDialogSubmit = useCallback((name: string, usernames: string[]) =>
            dialog === 'create' ? createGroup(name, usernames) : addMembers(usernames),
        [dialog, createGroup, addMembers]);

    let title: string | null = null;
    if (active?.type === 'direct') {
        title = `@${active.username}`;
    } else if (active?.type === 'group') {
        const listed = conversations.find((c) => c.type === 'group' && c.groupId === active.groupId);
        title = activeGroup?.name ?? (listed?.type === 'group' ? listed.name : 'Group');
    }

    return (
        <div className="app">
            <ChatHeader user={user} connected={connected} onLogout={logout}/>

            <div className="main">
                <Sidebar
                    chatApi={chatApi}
                    conversations={conversations}
                    unread={unread}
                    active={active}
                    onSelect={openConversation}
                    onNewGroup={() => setDialog('create')}
                    onError={showToast}
                />
                <ChatWindow
                    me={user.username}
                    active={active}
                    title={title}
                    group={activeGroup}
                    messages={messages}
                    onSend={handleSend}
                    onShowMembers={() => setDialog('settings')}
                    onAddMembers={() => setDialog('add')}
                    onLeave={leaveGroup}
                />
            </div>

            {(dialog === 'create' || dialog === 'add') && (
                <GroupDialog
                    mode={dialog}
                    chatApi={chatApi}
                    exclude={dialog === 'add' ? (activeGroup?.members.map((m) => m.username) ?? []) : []}
                    onSubmit={handleDialogSubmit}
                    onClose={() => setDialog(null)}
                    onError={showToast}
                />
            )}

            {/* Unmounts by itself when the group goes away (deleted, or I was removed). */}
            {dialog === 'settings' && activeGroup && (
                <GroupSettingsDialog
                    me={user.username}
                    group={activeGroup}
                    onRename={renameGroup}
                    onSetAdmin={setAdmin}
                    onRemove={removeMember}
                    onDelete={deleteGroup}
                    onClose={() => setDialog(null)}
                />
            )}

            <Toast message={toast}/>
        </div>
    );
}
