import {type ChangeEvent, type FormEvent, useState} from 'react';
import type {LoginRequest} from '../../types/api';

interface LoginFormProps {
    busy: boolean;
    onSubmit: (credentials: LoginRequest) => void;
}

export default function LoginForm({busy, onSubmit}: LoginFormProps) {
    const [form, setForm] = useState<LoginRequest>({username: '', password: ''});

    const update = (field: keyof LoginRequest) => (e: ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({...prev, [field]: e.target.value}));

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit({username: form.username.trim(), password: form.password});
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                placeholder="Username" autoComplete="username" required
                value={form.username} onChange={update('username')}
            />
            <input
                type="password" placeholder="Password" autoComplete="current-password" required
                value={form.password} onChange={update('password')}
            />
            <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Login'}
            </button>
        </form>
    );
}
