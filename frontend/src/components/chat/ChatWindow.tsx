import {useEffect, useRef} from 'react';
import type {ChatMessage} from '../../types/api';
import {cx} from '../../utils/classNames';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';

interface ChatWindowProps {
    /** Username of the logged-in user. */
    me: string;
    activeUser: string | null;
    messages: ChatMessage[];
    /** Returns true if the message was sent. */
    onSend: (content: string) => boolean;
}

export default function ChatWindow({me, activeUser, messages, onSend}: ChatWindowProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages, activeUser]);

    return (
        <section className="chat">
            <div className={cx('chat-title', !activeUser && 'muted')}>
                {activeUser ? `@${activeUser}` : 'Select or search for a user to start chatting'}
            </div>

            <div className="messages">
                {messages.map((m) => <MessageBubble key={m.id} message={m} mine={m.sender === me}/>)}
                <div ref={bottomRef}/>
            </div>

            <MessageComposer disabled={!activeUser} onSend={onSend}/>
        </section>
    );
}
