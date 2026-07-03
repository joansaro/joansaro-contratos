import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { TemplateManager } from './template-manager';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  await requireUser();
  const templates = await db.template.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ marginBottom: 8 }}>
        <h1 className="jo-display" style={{ margin: 0 }}>Templates</h1>
        <p className="jo-caption" style={{ margin: '4px 0 0' }}>
          Reusable contracts to start new documents faster.
        </p>
      </div>

      <TemplateManager
        templates={templates.map((t) => ({ id: t.id, title: t.title, content: t.content }))}
      />
    </div>
  );
}
