import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';
import { Icon } from '@/components/icons';
import { Avatar } from '@/components/ui';
import { SidebarNav } from './sidebar-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--jo-surface)',
          borderRight: '1px solid var(--jo-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          padding: '32px 16px 24px',
        }}
      >
        <div style={{ padding: '0 12px', marginBottom: 32 }}>
          <Link href="/dashboard" style={{ font: '600 18px var(--jo-font-sans)', letterSpacing: '-0.01em' }}>
            Joansaro
          </Link>
        </div>

        <SidebarNav />

        <div style={{ marginTop: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderTop: '1px solid var(--jo-border)',
              marginTop: 12,
              paddingTop: 16,
            }}
          >
            <Avatar name={user.name} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: '500 13px var(--jo-font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div className="jo-caption" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="jo-btn jo-btn-ghost jo-btn-sm"
                aria-label="Sign out"
                style={{ padding: '0 8px' }}
              >
                <Icon name="logout" size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, background: 'var(--jo-bg)' }}>{children}</main>
    </div>
  );
}
