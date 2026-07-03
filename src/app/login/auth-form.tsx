'use client';

import { useActionState, useState } from 'react';
import { loginAction, registerAction, type FormState } from '@/lib/actions';

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginState, loginFormAction, loginPending] = useActionState<FormState, FormData>(loginAction, {});
  const [regState, regFormAction, regPending] = useActionState<FormState, FormData>(registerAction, {});

  const state = mode === 'login' ? loginState : regState;
  const pending = mode === 'login' ? loginPending : regPending;

  return (
    <div className="jo-card" style={{ padding: 32 }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--jo-border)', marginBottom: 24 }}>
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              font: '500 14px var(--jo-font-sans)',
              color: mode === m ? 'var(--jo-fg)' : 'var(--jo-fg-secondary)',
              borderBottom: `2px solid ${mode === m ? 'var(--jo-accent)' : 'transparent'}`,
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'var(--jo-transition)',
            }}
          >
            {m === 'login' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form action={mode === 'login' ? loginFormAction : regFormAction} style={{ display: 'grid', gap: 16 }}>
        {state.error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: '#FEF2F2',
              color: 'var(--jo-danger)',
              font: '400 13px var(--jo-font-sans)',
            }}
          >
            {state.error}
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label className="jo-label" htmlFor="name">Full name</label>
            <input id="name" name="name" className="jo-input" placeholder="Ana García" required />
          </div>
        )}
        <div>
          <label className="jo-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="jo-input" placeholder="you@studio.com" required />
        </div>
        <div>
          <label className="jo-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="jo-input"
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            required
          />
        </div>

        <button type="submit" className="jo-btn jo-btn-primary jo-btn-lg" disabled={pending} style={{ width: '100%' }}>
          {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
