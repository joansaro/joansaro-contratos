import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createFromTemplateWithVarsAction } from '@/lib/actions';
import { extractTemplateVars } from '@/lib/template-vars';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

interface UseTemplateProps {
  params: Promise<{ id: string }>;
}

/** Rellena las variables {{asi}} de la plantilla antes de crear el documento. */
export default async function UseTemplatePage({ params }: UseTemplateProps) {
  const user = await requireUser();
  const { id } = await params;
  const tpl = await db.template.findFirst({
    where: { id, OR: [{ ownerId: user.id }, { ownerId: null }] },
  });
  if (!tpl) notFound();

  const vars = extractTemplateVars(tpl.content);
  const action = createFromTemplateWithVarsAction.bind(null, tpl.id);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 32px' }}>
      <Link href="/templates" className="jo-btn jo-btn-ghost jo-btn-sm" style={{ marginBottom: 12 }}>
        <Icon name="chevronLeft" size={14} /> Templates
      </Link>
      <h1 className="jo-h1" style={{ margin: '0 0 4px' }}>Use “{tpl.title}”</h1>
      <p className="jo-caption" style={{ margin: '0 0 20px' }}>
        {vars.length > 0
          ? 'Fill in the template variables — they replace the {{placeholders}} in the text.'
          : 'This template has no variables. Set a title and continue.'}
      </p>

      <form action={action} className="jo-card" style={{ padding: 24, display: 'grid', gap: 14 }}>
        <div>
          <label className="jo-label" htmlFor="t-title">Document title</label>
          <input id="t-title" name="title" className="jo-input" defaultValue={tpl.title} maxLength={160} />
        </div>
        {vars.map((name) => (
          <div key={name}>
            <label className="jo-label" htmlFor={`var-${name}`}>{name}</label>
            <input id={`var-${name}`} name={`var:${name}`} className="jo-input" placeholder={`{{${name}}}`} />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Link href="/templates" className="jo-btn jo-btn-secondary">Cancel</Link>
          <button type="submit" className="jo-btn jo-btn-primary">
            <Icon name="penLine" size={14} /> Create & prepare
          </button>
        </div>
      </form>
    </div>
  );
}
