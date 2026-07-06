'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createFromTemplateAction,
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
  type FormState,
} from '@/lib/actions';
import { Icon } from '@/components/icons';

export interface TemplateItem {
  id: string;
  title: string;
  content: string;
}

export function TemplateManager({ templates }: { templates: TemplateItem[] }) {
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; tpl: TemplateItem }>(null);
  const [pending, startTransition] = useTransition();

  const router = useRouter();
  const useTpl = (id: string) => router.push(`/templates/use/${id}`);

  const del = (tpl: TemplateItem) => {
    if (!window.confirm(`Delete template “${tpl.title}”?`)) return;
    startTransition(async () => {
      await deleteTemplateAction(tpl.id);
    });
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button type="button" className="jo-btn jo-btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <Icon name="plus" size={15} /> New template
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {templates.map((t) => (
          <div key={t.id} className="jo-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <span style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--jo-surface)', display: 'grid', placeItems: 'center', color: 'var(--jo-fg-secondary)' }}>
                <Icon name="template" size={16} />
              </span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={() => setModal({ mode: 'edit', tpl: t })} aria-label={`Edit ${t.title}`} style={{ padding: '0 8px' }}>
                  <Icon name="penLine" size={14} />
                </button>
                <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={() => del(t)} aria-label={`Delete ${t.title}`} style={{ padding: '0 8px', color: 'var(--jo-danger)' }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
            <div>
              <div style={{ font: '600 15px var(--jo-font-sans)' }}>{t.title}</div>
              <p className="jo-caption" style={{ margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {t.content.replace(/\n+/g, ' ').slice(0, 180)}
              </p>
            </div>
            <button type="button" className="jo-btn jo-btn-secondary jo-btn-sm" onClick={() => useTpl(t.id)} disabled={pending} style={{ marginTop: 'auto', width: '100%' }}>
              Use template <Icon name="chevronRight" size={13} />
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="jo-caption">No templates yet — create your first one.</p>
        )}
      </div>

      {modal && (
        <TemplateModal
          key={modal.mode === 'edit' ? modal.tpl.id : 'create'}
          tpl={modal.mode === 'edit' ? modal.tpl : null}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function TemplateModal({ tpl, onClose }: { tpl: TemplateItem | null; onClose: () => void }) {
  const action = tpl
    ? (prev: FormState, fd: FormData) => updateTemplateAction(tpl.id, prev, fd)
    : createTemplateAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <div className="jo-overlay" onClick={onClose}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--jo-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="jo-h2">{tpl ? 'Edit template' : 'New template'}</span>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={onClose} aria-label="Close" style={{ padding: '0 8px' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <form action={formAction} style={{ padding: 24, display: 'grid', gap: 16 }}>
          {state.error && (
            <div style={{ padding: '10px 12px', borderRadius: 6, background: '#FEF2F2', color: 'var(--jo-danger)', font: '400 13px var(--jo-font-sans)' }}>
              {state.error}
            </div>
          )}
          <div>
            <label className="jo-label" htmlFor="tpl-title">Title</label>
            <input id="tpl-title" name="title" className="jo-input" defaultValue={tpl?.title ?? ''} required />
          </div>
          <div>
            <label className="jo-label" htmlFor="tpl-content">Template text</label>
            <textarea id="tpl-content" name="content" className="jo-textarea" rows={12} defaultValue={tpl?.content ?? ''} required />
            <p className="jo-caption" style={{ margin: '6px 0 0' }}>
              Lines ending with “:” become section titles. Blank lines split paragraphs.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="jo-btn jo-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="jo-btn jo-btn-primary" disabled={pending}>
              {pending ? 'Saving…' : tpl ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
