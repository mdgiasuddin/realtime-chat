import {useState} from 'react';
import {useAuth} from '../context/AuthContext.jsx';

const emptyRegister = {name: '', username: '', password: '', email: '', phone: '', bio: ''};

export default function AuthPage() {
    const {login, register} = useAuth();
    const [tab, setTab] = useState('login');
    const [loginForm, setLoginForm] = useState({username: '', password: ''});
    const [regForm, setRegForm] = useState(emptyRegister);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const run = async (action) => {
        setError('');
        setBusy(true);
        try {
            await action();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const onLogin = (e) => {
        e.preventDefault();
        run(() => login(loginForm.username.trim(), loginForm.password));
    };

    const onRegister = (e) => {
        e.preventDefault();
        const orNull = (v) => (v.trim() ? v.trim() : null);
        run(() =>
            register({
                name: regForm.name.trim(),
                username: regForm.username.trim(),
                password: regForm.password,
                email: orNull(regForm.email),
                phone: orNull(regForm.phone),
                bio: orNull(regForm.bio)
            })
        );
    };

    const setReg = (field) => (e) => setRegForm({...regForm, [field]: e.target.value});

    return (
        <div className="auth-wrap">
            <div className="card">
                <h1>Spring Chat</h1>

                <div className="tabs">
                    {['login', 'register'].map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`tab ${tab === t ? 'active' : ''}`}
                            onClick={() => {
                                setTab(t);
                                setError('');
                            }}
                        >
                            {t === 'login' ? 'Login' : 'Register'}
                        </button>
                    ))}
                </div>

                {tab === 'login' ? (
                    <form onSubmit={onLogin}>
                        <input
                            placeholder="Username" autoComplete="username" required
                            value={loginForm.username}
                            onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                        />
                        <input
                            type="password" placeholder="Password" autoComplete="current-password" required
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                        />
                        <button className="primary" type="submit" disabled={busy}>
                            {busy ? 'Signing in…' : 'Login'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={onRegister}>
                        <input placeholder="Full name" required value={regForm.name} onChange={setReg('name')}/>
                        <input
                            placeholder="Username (letters, digits, _ .)" required minLength={3}
                            value={regForm.username} onChange={setReg('username')}
                        />
                        <input
                            type="password" placeholder="Password (min 6 chars)" required minLength={6}
                            value={regForm.password} onChange={setReg('password')}
                        />
                        <input type="email" placeholder="Email (optional)" value={regForm.email}
                               onChange={setReg('email')}/>
                        <input placeholder="Phone (optional)" value={regForm.phone} onChange={setReg('phone')}/>
                        <input placeholder="Short bio (optional)" value={regForm.bio} onChange={setReg('bio')}/>
                        <button className="primary" type="submit" disabled={busy}>
                            {busy ? 'Creating…' : 'Create account'}
                        </button>
                    </form>
                )}

                <div className="error">{error}</div>
            </div>
        </div>
    );
}
