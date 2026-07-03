import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { Avatar, Badge, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const user = await requireUser();
  const signers = await db.signer.findMany({
    where: { document: { ownerId: user.id } },
    include: { document: true },
    orderBy: { sentAt: 'desc' },
  });

  // Group by email
  const byEmail = new Map<string, { name: string; email: string; docs: typeof signers }>();
  for (const s of signers) {
    const entry = byEmail.get(s.email) ?? { name: s.name, email: s.email, docs: [] as typeof signers };
    entry.docs.push(s);
    byEmail.set(s.email, entry);
  }
  const clients = Array.from(byEmail.values());

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="jo-display" style={{ margin: 0 }}>Clients</h1>
        <p className="jo-caption" style={{ margin: '4px 0 0' }}>
          Everyone you have sent documents to.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="jo-card">
          <EmptyState title="No clients yet">
            When you send a document for signature, the recipient shows up here.
          </EmptyState>
        </div>
      ) : (
        <div className="jo-card" style={{ overflow: 'hidden' }}>
          <table className="jo-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Documents</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const latest = c.docs[0]!;
                return (
                  <tr key={c.email}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={c.name} />
                        <span>
                          <span style={{ display: 'block', font: '500 14px var(--jo-font-sans)' }}>{c.name}</span>
                          <span className="jo-caption">{c.email}</span>
                        </span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--jo-fg-secondary)' }}>{c.docs.length}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <span className="jo-caption">{latest.document.title}</span>
                        <Badge status={latest.document.status} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
