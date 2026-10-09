import {type SubmitEvent, useState} from 'react';
import type {Group} from '../../types/api';
import {MAX_GROUP_NAME_LENGTH} from './GroupDialog';
import Modal from './Modal';

interface GroupSettingsDialogProps {
    /** Username of the logged-in user. */
    me: string;
    /** The open group; kept up to date by the parent, so changes show up immediately. */
    group: Group;
    // Each resolves to false if it failed (the error has already been reported).
    onRename: (name: string) => Promise<boolean>;
    onSetAdmin: (username: string, admin: boolean) => Promise<boolean>;
    onRemove: (username: string) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
    onClose: () => void;
}

/** Member list for everyone; rename, roles, remove and delete for admins. */
export default function GroupSettingsDialog({
                                                me, group, onRename, onSetAdmin, onRemove, onDelete, onClose
                                            }: GroupSettingsDialogProps) {
    const [name, setName] = useState(group.name);
    const [busy, setBusy] = useState(false);
    const admins = new Set(group.admins);
    const iAmAdmin = admins.has(me);

    /** Runs one action at a time, so double clicks don't send two requests. */
    const run = async (action: () => Promise<boolean>) => {
        setBusy(true);
        const ok = await action();
        setBusy(false);
        return ok;
    };

    const handleRename = (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed && trimmed !== group.name) void run(() => onRename(trimmed));
    };

    const handleRemove = (username: string) => {
        if (window.confirm(`Remove @${username} from ${group.name}?`)) void run(() => onRemove(username));
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete ${group.name} and all its messages for everyone?`)) return;
        if (await run(onDelete)) onClose();
    };

    return (
        <Modal title={group.name} onClose={onClose}>
            {iAmAdmin && (
                <form className="inline-form" onSubmit={handleRename}>
                    <input
                        aria-label="Group name"
                        required
                        maxLength={MAX_GROUP_NAME_LENGTH}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <button type="submit" disabled={busy || name.trim() === '' || name.trim() === group.name}>
                        Rename
                    </button>
                </form>
            )}

            <h3>{group.members.length} members</h3>
            <ul className="list members">
                {group.members.map((m) => {
                    const isAdmin = admins.has(m.username);
                    return (
                        <li key={m.id}>
                            <div className="who">
                                <b>
                                    {m.name}
                                    {m.username === me && <span className="muted"> (you)</span>}
                                    {isAdmin && <span className="tag">admin</span>}
                                </b>
                                <small>@{m.username}</small>
                            </div>
                            {iAmAdmin && m.username !== me && (
                                <div className="actions">
                                    <button
                                        type="button" className="small" disabled={busy}
                                        onClick={() => void run(() => onSetAdmin(m.username, !isAdmin))}
                                    >
                                        {isAdmin ? 'Remove admin' : 'Make admin'}
                                    </button>
                                    <button
                                        type="button" className="small" disabled={busy}
                                        onClick={() => handleRemove(m.username)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="dialog-actions">
                {iAmAdmin && (
                    <button type="button" className="danger" disabled={busy} onClick={() => void handleDelete()}>
                        Delete group
                    </button>
                )}
                <button type="button" onClick={onClose}>Close</button>
            </div>
        </Modal>
    );
}
