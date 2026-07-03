import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { NewDocumentChoices } from './choices';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
  await requireUser();
  const templates = await db.template.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="jo-display" style={{ margin: 0 }}>New document</h1>
        <p className="jo-caption" style={{ margin: '4px 0 0' }}>
          How do you want to start?
        </p>
      </div>

      <NewDocumentChoices
        templates={templates.map((t) => ({ id: t.id, title: t.title, preview: t.content.slice(0, 140) }))}
      />
    </div>
  );
}
