import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { EmptyState } from '@/components/ui';
import { OutboxList } from './outbox-list';

export const dynamic = 'force-dynamic';

/** Bandeja de salida demo: los emails que la app "envió". */
export default async function OutboxPage() {
  await requireUser();
  const emails = await db.outboxEmail.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 32px' }}>
      <h1 className="jo-display" style={{ margin: 0 }}>Email outbox</h1>
      <p className="jo-caption" style={{ margin: '4px 0 20px' }}>
        Demo system — invitations, reminders and notifications land here instead of a real inbox.
      </p>

      {emails.length === 0 ? (
        <div className="jo-card">
          <EmptyState title="Nothing sent yet">
            Send a document for signature and the invitation email will show up here.
          </EmptyState>
        </div>
      ) : (
        <OutboxList
          emails={emails.map((e) => ({
            id: e.id,
            to: e.to,
            subject: e.subject,
            body: e.body,
            createdAt: e.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
