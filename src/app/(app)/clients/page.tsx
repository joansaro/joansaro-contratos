import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { Avatar, Badge, EmptyState } from '@/components/ui';
import { ContactActions, NewContactButton } from './contact-actions';

export const dynamic = 'force-dynamic';

/** Directorio de contactos (CRUD) + historial de documentos por email. */
export default async function ClientsPage() {
  const user = await requireUser();

  const [contacts, signers] = await Promise.all([
    db.contact.findMany({ where: { ownerId: user.id }, orderBy: { name: 'asc' } }),
    db.signer.findMany({
      where: { document: { ownerId: user.id } },
      include: { document: { select: { id: true, title: true, status: true } } },
      orderBy: { sentAt: 'desc' },
    }),
  ]);

  const docsByEmail = new Map<string, typeof signers>();
  for (const s of signers) {
    const list = docsByEmail.get(s.email) ?? [];
    list.push(s);
    docsByEmail.set(s.email, list);
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="jo-display" style={{ margin: 0 }}>Clients</h1>
          <p className="jo-caption" style={{ margin: '4px 0 0' }}>
            Your contact book. Signers are saved here automatically when you send documents.
          </p>
        </div>
        <NewContactButton />
      </div>

      {contacts.length === 0 ? (
        <div className="jo-card">
          <EmptyState title="No contacts yet" action={<NewContactButton />}>
            Add a contact manually, or send a document — recipients are saved automatically.
          </EmptyState>
        </div>
      ) : (
        <div className="jo-card" style={{ overflow: 'hidden' }}>
          <table className="jo-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Documents</th>
                <th>Latest</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const docs = docsByEmail.get(c.email) ?? [];
                const latest = docs[0];
                return (
                  <tr key={c.id}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={c.name} />
                        <span>
                          <span style={{ display: 'block', font: '500 14px var(--jo-font-sans)' }}>{c.name}</span>
                          <span className="jo-caption">{c.email}</span>
                          {c.notes && <span className="jo-caption" style={{ display: 'block', color: 'var(--jo-fg-tertiary)' }}>{c.notes}</span>}
                        </span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--jo-fg-secondary)' }}>{docs.length}</td>
                    <td>
                      {latest ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="jo-caption" style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {latest.document.title}
                          </span>
                          <Badge status={latest.document.status} />
                        </span>
                      ) : (
                        <span className="jo-caption">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <ContactActions contact={{ id: c.id, name: c.name, email: c.email, notes: c.notes }} />
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
