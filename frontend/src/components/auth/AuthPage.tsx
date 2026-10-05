import {useState} from 'react';
import {useAuth} from '../../hooks/useAuth';
import {cx} from '../../utils/classNames';
import {getErrorMessage} from '../../utils/errors';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

type AuthTab = 'login' | 'register';

const TABS: { id: AuthTab; label: string }[] = [
    {id: 'login', label: 'Login'},
    {id: 'register', label: 'Register'}
];

export default function AuthPage() {
    const {login, register} = useAuth();
    const [tab, setTab] = useState<AuthTab>('login');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    /** Runs a submit action, tracking the busy flag and surfacing its error. */
    const run = async (action: () => Promise<void>) => {
        setError('');
        setBusy(true);
        try {
            await action();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const switchTab = (next: AuthTab) => {
        setTab(next);
        setError('');
    };

    return (
        <div className="auth-wrap">
            <div className="card">
                <h1>Spring Chat</h1>

                <div className="tabs">
                    {TABS.map(({id, label}) => (
                        <button
                            key={id}
                            type="button"
                            className={cx('tab', tab === id && 'active')}
                            onClick={() => switchTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'login'
                    ? <LoginForm busy={busy} onSubmit={(credentials) => run(() => login(credentials))}/>
                    : <RegisterForm busy={busy} onSubmit={(data) => run(() => register(data))}/>}

                <div className="error">{error}</div>
            </div>
        </div>
    );
}
