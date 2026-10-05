import type {ChatMessage} from '../../types/api';
import {formatTime} from '../../utils/format';

interface MessageBubbleProps {
    message: ChatMessage;
    mine: boolean;
}

export default function MessageBubble({message, mine}: MessageBubbleProps) {
    return (
        <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>
            <div>{message.content}</div>
            <time dateTime={message.sentAt}>{formatTime(message.sentAt)}</time>
        </div>
    );
}
