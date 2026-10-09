import {useEffect, useRef} from 'react';
import type {ChatMessage, Group} from '../../types/api';
import {cx} from '../../utils/classNames';
import type {ChatTarget} from '../../utils/conversation';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';

interface ChatWindowProps {
    /** Username of the logged-in user. */
    me: string;
    active: ChatTarget | null;
    /** "@bob" or the group's name; null when no chat is open. */
    title: string | null;
    /** Details of the open group (null while loading, or for direct chats). */
    group: Group | null;
    messages: ChatMessage[];
    /** Returns true if the message was sent. */
    onSend: (content: string) => boolean;
    /** Opens the member list / group settings. */
    onShowMembers: () => void;
    onAddMembers: () => void;
    onLeave: () => void;
}

export default function ChatWindow({
                                       me, active, title, group, messages, onSend, onShowMembers, onAddMembers, onLeave
                                   }: ChatWindowProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const isGroup = active?.type === 'group';

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages, active]);

    const handleLeave = () => {
        if (window.confirm(`Leave ${title ?? 'this group'}?`)) onLeave();
    };

    return (
        <section className="chat">
            <div className={cx('chat-title', !active && 'muted')}>
                <div>{title ?? 'Select or search for a user to start chatting'}</div>
                {isGroup && (
                    <div className="actions">
                        <button type="button" className="small" onClick={onShowMembers} disabled={!group}>
                            {group ? `${group.members.length} members` : 'Members'}
                        </button>
                        <button type="button" className="small" onClick={onAddMembers} disabled={!group}>
                            Add members
                        </button>
                        <button type="button" className="small" onClick={handleLeave}>Leave</button>
                    </div>
                )}
            </div>

            <div className="messages">
                {messages.map((m) => {
                    const mine = m.sender === me;
                    return <MessageBubble key={m.id} message={m} mine={mine} showSender={isGroup && !mine}/>;
                })}
                <div ref={bottomRef}/>
            </div>

            <MessageComposer disabled={!active} onSend={onSend}/>
        </section>
    );
}
