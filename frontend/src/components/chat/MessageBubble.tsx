import type {ChatMessage} from '../../types/api';
import {formatTime} from '../../utils/format';

interface MessageBubbleProps {
    message: ChatMessage;
    mine: boolean;
    /** Show who wrote it (in groups, for other people's messages). */
    showSender?: boolean;
}

export default function MessageBubble({message, mine, showSender = false}: MessageBubbleProps) {
    return (
        <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>
            {showSender && <b className="sender">@{message.sender}</b>}
            <div>{message.content}</div>
            <time dateTime={message.sentAt}>{formatTime(message.sentAt)}</time>
        </div>
    );
}
