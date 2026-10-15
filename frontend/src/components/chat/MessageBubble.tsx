import type {DisplayMessage} from '../../crypto/messageCipher';
import {cx} from '../../utils/classNames';
import {formatTime} from '../../utils/format';

interface MessageBubbleProps {
    message: DisplayMessage;
    mine: boolean;
    /** Show who wrote it (in groups, for other people's messages). */
    showSender?: boolean;
}

export default function MessageBubble({message, mine, showSender = false}: MessageBubbleProps) {
    return (
        <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>
            {showSender && <b className="sender">@{message.sender}</b>}
            <div className={cx(message.security === 'unreadable' && 'unreadable')}>{message.content}</div>
            <time dateTime={message.sentAt}>
                {message.security === 'unencrypted' &&
                    <span title="Sent without end-to-end encryption">Not encrypted · </span>}
                {formatTime(message.sentAt)}
            </time>
        </div>
    );
}
