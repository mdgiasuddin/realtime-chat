import {type SubmitEvent, useState} from 'react';

// The backend limits the encrypted envelope (SendMessageRequest.MAX_CONTENT_LENGTH), not the text; this keeps
// direct and small-group messages well within it.
const MAX_MESSAGE_LENGTH = 2000;

interface MessageComposerProps {
    disabled: boolean;
    /** Resolves to true if the message was sent; the input is only cleared then. */
    onSend: (content: string) => Promise<boolean>;
}

export default function MessageComposer({disabled, onSend}: MessageComposerProps) {
    const [text, setText] = useState('');
    /** Encrypting (fetches the recipients' keys first). */
    const [sending, setSending] = useState(false);
    const content = text.trim();

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!content || sending) return;
        setSending(true);
        try {
            if (await onSend(content)) setText('');
        } finally {
            setSending(false);
        }
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
            <button className="primary" type="submit" disabled={disabled || sending || !content}>
                Send
            </button>
        </form>
    );
}
