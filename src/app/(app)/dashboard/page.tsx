import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { FilterBar } from './filter-bar';

export const dynamic = 'force-dynamic';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600e3);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  if (h < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface DashboardProps {
  searchParams: Promise<{ tab?: string; q?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = (sp.tab ?? 'all').toUpperCase();
  const q = (sp.q ?? '').trim();

  const docs = await db.document.findMany({
    where: { ownerId: user.id },
    include: { signer: true },
    orderBy: { updatedAt: 'desc' },
  });

  const counts: Record<string, number> = { ALL: docs.length };
  for (const d of docs) counts[d.status] = (counts[d.status] ?? 0) + 1;

  const filtered = docs.filter((d) => {
    if (tab !== 'ALL' && d.status !== tab) return false;
    if (q) {
      const hay = `${d.title} ${d.signer?.name ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="jo-display" style={{ margin: 0 }}>Documents</h1>
          <p className="jo-caption" style={{ margin: '4px 0 0' }}>
            Create, send and track your contracts.
          </p>
        </div>
        <Link href="/documents/new" className="jo-btn jo-btn-primary">
          <Icon name="plus" size={15} /> New document
        </Link>
      </div>

      <FilterBar counts={counts} />

      {filtered.length === 0 ? (
        <div className="jo-card" style={{ marginTop: 16 }}>
          <EmptyState
            title={docs.length === 0 ? 'No documents yet' : 'Nothing matches'}
            action={
              docs.length === 0 ? (
                <Link href="/documents/new" className="jo-btn jo-btn-primary">
                  <Icon name="plus" size={15} /> Create your first document
                </Link>
              ) : undefined
            }
          >
            {docs.length === 0
              ? 'Create a contract from scratch, a template, or upload a PDF.'
              : 'Try a different filter or search term.'}
          </EmptyState>
        </div>
      ) : (
        <div className="jo-card" style={{ marginTop: 16, overflow: 'hidden' }}>
          <table className="jo-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Client</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="jo-row-link">
                  <td style={{ padding: 0 }} colSpan={4}>
                    <Link
                      href={`/documents/${d.id}`}
                      style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 0.8fr', alignItems: 'center' }}
                    >
                      <span style={{ padding: '14px 16px', font: '500 14px var(--jo-font-sans)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon name="fileText" size={16} style={{ color: 'var(--jo-fg-tertiary)', flexShrink: 0 }} />
                        {d.title}
                      </span>
                      <span style={{ padding: '14px 16px', color: 'var(--jo-fg-secondary)' }}>
                        {d.signer?.name ?? '—'}
                      </span>
                      <span style={{ padding: '14px 16px' }}>
                        <Badge status={d.status} />
                      </span>
                      <span className="jo-caption" style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {timeAgo(d.updatedAt)}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
