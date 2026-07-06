'use client';

import { useState } from 'react';

interface Email {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}

export function OutboxList({ emails }: { emails: Email[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="jo-card" style={{ overflow: 'hidden' }}>
      {emails.map((e, i) => (
        <div key={e.id} style={{ borderTop: i > 0 ? '1px solid var(--jo-border)' : 'none' }}>
          <button
            type="button"
            onClick={() => setOpen(open === e.id ? null : e.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '13px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ font: '500 13px var(--jo-font-sans)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.subject}
            </span>
            <span className="jo-caption" style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.to}</span>
            <span className="jo-caption" style={{ color: 'var(--jo-fg-tertiary)', whiteSpace: 'nowrap' }}>
              {new Date(e.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </button>
          {open === e.id && (
            <pre style={{ margin: 0, padding: '0 16px 14px', font: '400 12px monospace', whiteSpace: 'pre-wrap', color: 'var(--jo-fg-secondary)' }}>
              {e.body}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
