import {useEffect, useRef, useState} from 'react';

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

export default function ChatWindow({me, active, messages, onSend}) {
    const [text, setText] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages, active]);

    const submit = (e) => {
        e.preventDefault();
        const content = text.trim();
        if (!content) return;
        if (onSend(content)) setText('');
    };

    return (
        <section className="chat">
            <div className={`chat-title ${active ? '' : 'muted'}`}>
                {active ? `@${active}` : 'Select or search for a user to start chatting'}
            </div>

            <div className="messages">
                {messages.map((m) => (
                    <div key={m.id} className={`bubble ${m.sender === me ? 'mine' : 'theirs'}`}>
                        <div>{m.content}</div>
                        <time>{fmtTime(m.sentAt)}</time>
                    </div>
                ))}
                <div ref={bottomRef}/>
            </div>

            <form className="send" onSubmit={submit}>
                <input
                    placeholder="Type a message…"
                    autoComplete="off"
                    maxLength={2000}
                    disabled={!active}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                <button className="primary" type="submit" disabled={!active || !text.trim()}>
                    Send
                </button>
            </form>
        </section>
    );
}
