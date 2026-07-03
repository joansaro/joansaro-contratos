import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AuthForm } from './auth-form';

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect('/dashboard');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--jo-surface)',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="jo-h2" style={{ letterSpacing: '-0.01em' }}>Joansaro</span>
          <p className="jo-caption" style={{ margin: '6px 0 0' }}>
            Send, track and sign contracts.
          </p>
        </div>
        <AuthForm />
        <p className="jo-caption" style={{ textAlign: 'center', marginTop: 20 }}>
          Demo account: <code>demo@joansaro.dev</code> / <code>Demo1234!</code>
        </p>
      </div>
    </main>
  );
}
