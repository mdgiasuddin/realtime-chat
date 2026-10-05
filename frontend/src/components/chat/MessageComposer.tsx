import {type FormEvent, useState} from 'react';

// Matches @Size(max = 2000) on SendMessageRequest.content in the backend.
const MAX_MESSAGE_LENGTH = 2000;

interface MessageComposerProps {
    disabled: boolean;
    /** Returns true if the message was sent; the input is only cleared then. */
    onSend: (content: string) => boolean;
}

export default function MessageComposer({disabled, onSend}: MessageComposerProps) {
    const [text, setText] = useState('');
    const content = text.trim();

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (content && onSend(content)) setText('');
    };

    return (
        <form className="send" onSubmit={handleSubmit}>
            <input
                placeholder="Type a message…"
                autoComplete="off"
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={disabled}
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <button className="primary" type="submit" disabled={disabled || !content}>
                Send
            </button>
        </form>
    );
}
