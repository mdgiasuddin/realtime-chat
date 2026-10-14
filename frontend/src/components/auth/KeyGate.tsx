import {type FormEvent, type ReactNode, useEffect, useState} from 'react';
import {useAuth} from '../../hooks/useAuth';
import type {AuthUser} from '../../context/AuthContext';
import {getErrorMessage} from '../../utils/errors';
import {checkKeyStatus, type KeyStatus, restoreKeys, setupKeys} from '../../crypto/identity';

const MIN_PASSPHRASE_LENGTH = 12;

/** Blocks the chat until this device holds the user's E2EE key (set up for the first time, or restored). */
export default function KeyGate({user, children}: { user: AuthUser; children: ReactNode }) {
    const {chatApi, logout} = useAuth();
    const [status, setStatus] = useState<KeyStatus | 'loading'>('loading');
    const [passphrase, setPassphrase] = useState('');
    const [confirm, setConfirm] = useState('');
    const [rotate, setRotate] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        checkKeyStatus(user.username, chatApi)
            .then((s) => {
                if (!cancelled) setStatus(s);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(getErrorMessage(err));
            });
        return () => {
            cancelled = true;
        };
    }, [user.username, chatApi]);

    if (status === 'ready') return <>{children}</>;

    if (status === 'loading') {
        return (
            <div className="auth-wrap">
                <div className="card">
                    {error ? <div className="error">{error}</div> : 'Loading keys…'}
                </div>
            </div>
        );
    }

    const isSetup = status === 'needs-setup';

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (isSetup) {
            if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
                setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters (a few random words works well)`);
                return;
            }
            if (passphrase !== confirm) {
                setError('Passphrases do not match');
                return;
            }
        }
        setBusy(true);
        try {
            if (isSetup) await setupKeys(user.username, passphrase, chatApi, rotate);
            else await restoreKeys(user.username, passphrase, chatApi);
            setPassphrase('');
            setConfirm('');
            setStatus('ready');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const startOver = () => {
        const ok = window.confirm(
            'Creating new keys means you can no longer read your previous messages, ' +
            'and your contacts will see that your key changed. Continue?');
        if (!ok) return;
        setRotate(true);
        setStatus('needs-setup');
        setPassphrase('');
        setConfirm('');
        setError('');
    };

    return (
        <div className="auth-wrap">
            <div className="card">
                <h1>{isSetup ? 'Create your recovery passphrase' : 'Unlock your messages'}</h1>

                <p className="muted">
                    {isSetup
                        ? 'Your messages are encrypted so only you and the recipient can read them. ' +
                        'This passphrase protects the backup of your key. We cannot recover it. ' +
                        'If you forget it and lose this device, old messages are gone.'
                        : status === 'mismatch'
                            ? 'The key on this device does not match your account. ' +
                            'Enter your recovery passphrase to restore the correct one.'
                            : 'Enter your recovery passphrase to restore your key on this device.'}
                </p>

                <form onSubmit={submit}>
                    <input type="password" placeholder="Recovery passphrase" autoComplete="off" required
                           value={passphrase} onChange={(e) => setPassphrase(e.target.value)}/>
                    {isSetup && (
                        <input type="password" placeholder="Confirm passphrase" autoComplete="off" required
                               value={confirm} onChange={(e) => setConfirm(e.target.value)}/>
                    )}
                    <button className="primary" type="submit" disabled={busy}>
                        {busy ? 'Working…' : isSetup ? 'Create keys' : 'Restore'}
                    </button>
                </form>

                {!isSetup && (
                    <button type="button" style={{marginTop: 10}} disabled={busy} onClick={startOver}>
                        Forgot passphrase? Start over
                    </button>
                )}
                <button type="button" style={{marginTop: 10}} disabled={busy} onClick={logout}>
                    Log out
                </button>
                <div className="error">{error}</div>
            </div>
        </div>
    );
}
