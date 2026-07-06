'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'partially_signed', label: 'Partial' },
  { id: 'signed', label: 'Signed' },
  { id: 'declined', label: 'Declined' },
  { id: 'voided', label: 'Voided' },
  { id: 'expired', label: 'Expired' },
];

export function FilterBar({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get('tab') ?? 'all';
  const q = sp.get('q') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/dashboard?${next.toString()}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--jo-border)' }}>
      <div style={{ display: 'flex', gap: 24 }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id === 'all' ? 'ALL' : t.id.toUpperCase()] ?? 0;
          if (t.id !== 'all' && count === 0 && !active) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setParam('tab', t.id === 'all' ? '' : t.id)}
              style={{
                padding: '10px 0',
                border: 'none',
                background: 'transparent',
                font: '500 14px var(--jo-font-sans)',
                color: active ? 'var(--jo-fg)' : 'var(--jo-fg-secondary)',
                borderBottom: `2px solid ${active ? 'var(--jo-accent)' : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'var(--jo-transition)',
              }}
            >
              {t.label}
              <span style={{ font: '500 12px var(--jo-font-sans)', color: 'var(--jo-fg-tertiary)' }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', width: 240, marginBottom: 6 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--jo-fg-tertiary)', display: 'flex' }}>
          <Icon name="search" size={14} />
        </span>
        <input
          className="jo-input"
          style={{ paddingLeft: 32, height: 32, fontSize: 13 }}
          placeholder="Search documents…"
          defaultValue={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
      </div>
    </div>
  );
}
