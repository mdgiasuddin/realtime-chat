import {type ChangeEvent, type FormEvent, useState} from 'react';
import type {RegisterRequest} from '../../types/api';

/** Every field is a plain string while editing; optional ones become null on submit. */
type RegisterFormState = Record<keyof RegisterRequest, string>;

const EMPTY_FORM: RegisterFormState = {name: '', username: '', password: '', email: '', phone: '', bio: ''};

const trimOrNull = (value: string): string | null => value.trim() || null;

function toRegisterRequest(form: RegisterFormState): RegisterRequest {
    return {
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        email: trimOrNull(form.email),
        phone: trimOrNull(form.phone),
        bio: trimOrNull(form.bio)
    };
}

interface RegisterFormProps {
    busy: boolean;
    onSubmit: (data: RegisterRequest) => void;
}

export default function RegisterForm({busy, onSubmit}: RegisterFormProps) {
    const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM);

    const update = (field: keyof RegisterFormState) => (e: ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({...prev, [field]: e.target.value}));

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit(toRegisterRequest(form));
    };

    return (
        <form onSubmit={handleSubmit}>
            <input placeholder="Full name" required value={form.name} onChange={update('name')}/>
            <input
                placeholder="Username (letters, digits, _ .)" required minLength={3}
                value={form.username} onChange={update('username')}
            />
            <input
                type="password" placeholder="Password (min 6 chars)" required minLength={6}
                value={form.password} onChange={update('password')}
            />
            <input type="email" placeholder="Email (optional)" value={form.email} onChange={update('email')}/>
            <input placeholder="Phone (optional)" value={form.phone} onChange={update('phone')}/>
            <input placeholder="Short bio (optional)" value={form.bio} onChange={update('bio')}/>
            <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create account'}
            </button>
        </form>
    );
}
