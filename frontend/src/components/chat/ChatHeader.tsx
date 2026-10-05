import type {AuthUser} from '../../context/AuthContext';
import {cx} from '../../utils/classNames';

interface ChatHeaderProps {
    user: AuthUser;
    connected: boolean;
    onLogout: () => void;
}

export default function ChatHeader({user, connected, onLogout}: ChatHeaderProps) {
    return (
        <header>
            <div>
                <strong>{user.name}</strong> <span className="muted">@{user.username}</span>
            </div>
            <div className="right">
                <span
                    className={cx('dot', connected ? 'on' : 'off')}
                    title={connected ? 'connected' : 'disconnected'}
                />
                <button type="button" onClick={onLogout}>Logout</button>
            </div>
        </header>
    );
}
