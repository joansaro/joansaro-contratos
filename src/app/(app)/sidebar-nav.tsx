'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';

const ITEMS = [
  { href: '/dashboard', icon: 'fileText', label: 'Documents' },
  { href: '/templates', icon: 'template', label: 'Templates' },
  { href: '/clients', icon: 'users', label: 'Clients' },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: 'grid', gap: 2 }}>
      {ITEMS.map((item) => {
        const active =
          item.href === '/dashboard'
            ? pathname === '/dashboard' || pathname.startsWith('/documents')
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 36,
              padding: '0 12px',
              borderRadius: 6,
              background: active ? '#FFFFFF' : 'transparent',
              color: active ? 'var(--jo-fg)' : 'var(--jo-fg-secondary)',
              boxShadow: active ? 'var(--jo-shadow-sm)' : 'none',
              font: '500 14px var(--jo-font-sans)',
              transition: 'var(--jo-transition)',
            }}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
