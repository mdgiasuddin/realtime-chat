import {type SubmitEvent, useState} from 'react';
import type {ChatApi} from '../../api/endpoints';
import type {UserSummary} from '../../types/api';
import MemberPicker from './MemberPicker';
import Modal from './Modal';

// Matches @Size(max = 100) on CreateGroupRequest.name / RenameGroupRequest.name in the backend.
export const MAX_GROUP_NAME_LENGTH = 100;

interface GroupDialogProps {
    /** 'create': name + members; 'add': members only. */
    mode: 'create' | 'add';
    chatApi: ChatApi;
    /** Usernames that can't be picked (existing members). */
    exclude: string[];
    /** Resolves to true on success, which closes the dialog. */
    onSubmit: (name: string, usernames: string[]) => Promise<boolean>;
    onClose: () => void;
    onError: (message: string) => void;
}

/** Modal for creating a group or adding members to one. Mount it to open it. */
export default function GroupDialog({mode, chatApi, exclude, onSubmit, onClose, onError}: GroupDialogProps) {
    const [name, setName] = useState('');
    const [members, setMembers] = useState<UserSummary[]>([]);
    const [busy, setBusy] = useState(false);

    const creating = mode === 'create';
    const canSubmit = !busy && members.length > 0 && (!creating || name.trim() !== '');

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        const ok = await onSubmit(name.trim(), members.map((u) => u.username));
        setBusy(false);
        if (ok) onClose();
    };

    return (
        <Modal title={creating ? 'New group' : 'Add members'} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                {creating && (
                    <input
                        placeholder="Group name"
                        required
                        maxLength={MAX_GROUP_NAME_LENGTH}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                )}
                <MemberPicker
                    chatApi={chatApi}
                    selected={members}
                    exclude={exclude}
                    onChange={setMembers}
                    onError={onError}
                />
                <div className="dialog-actions">
                    <button type="button" onClick={onClose}>Cancel</button>
                    <button className="primary" type="submit" disabled={!canSubmit}>
                        {busy ? 'Saving…' : creating ? 'Create group' : 'Add'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
