'use client';

import { useRef, useState, useTransition } from 'react';
import {
  createBlankDocumentAction,
  createFromPdfAction,
  createFromTemplateAction,
} from '@/lib/actions';
import { Icon } from '@/components/icons';

interface TemplateOption {
  id: string;
  title: string;
  preview: string;
}

type Mode = 'choose' | 'blank' | 'template';

export function NewDocumentChoices({ templates }: { templates: TemplateOption[] }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPdf = () => fileRef.current?.click();

  const onPdf = (file: File | null) => {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set('pdf', file);
    startTransition(async () => {
      try {
        await createFromPdfAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
    });
  };

  const useTemplate = (id: string) => {
    startTransition(async () => {
      await createFromTemplateAction(id);
    });
  };

  const card: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    padding: 24,
    background: '#fff',
    border: '1px solid var(--jo-border)',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'var(--jo-transition)',
    font: 'inherit',
  };

  return (
    <div>
      {error && (
        <div style={{ padding: '10px 12px', borderRadius: 6, background: '#FEF2F2', color: 'var(--jo-danger)', marginBottom: 16, font: '400 13px var(--jo-font-sans)' }}>
          {error}
        </div>
      )}

      {mode === 'choose' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <ChoiceCard icon="upload" title="Upload a PDF" description="Use a contract you already have" onClick={pickPdf} busy={pending} style={card} />
            <ChoiceCard icon="fileText" title="Use a template" description="Start from one of your saved templates" onClick={() => setMode('template')} busy={pending} style={card} />
            <ChoiceCard icon="penLine" title="Start blank" description="Write your contract from scratch" onClick={() => setMode('blank')} busy={pending} style={card} />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => onPdf(e.target.files?.[0] ?? null)}
          />
          <p className="jo-caption" style={{ marginTop: 20 }}>
            Templates available in your workspace · {templates.length} templates
          </p>
        </>
      )}

      {mode === 'template' && (
        <div>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={() => setMode('choose')} style={{ marginBottom: 16 }}>
            <Icon name="chevronLeft" size={14} /> Back
          </button>
          <div style={{ display: 'grid', gap: 12 }}>
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => useTemplate(t.id)} disabled={pending} style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--jo-surface)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--jo-fg-secondary)' }}>
                  <Icon name="template" size={18} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', font: '500 14px var(--jo-font-sans)' }}>{t.title}</span>
                  <span className="jo-caption" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>
                    {t.preview}…
                  </span>
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--jo-fg-tertiary)', display: 'flex' }}>
                  <Icon name="chevronRight" size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'blank' && (
        <div className="jo-card" style={{ padding: 24, maxWidth: 640 }}>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={() => setMode('choose')} style={{ marginBottom: 16 }}>
            <Icon name="chevronLeft" size={14} /> Back
          </button>
          <form action={createBlankDocumentAction} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label className="jo-label" htmlFor="title">Document title</label>
              <input id="title" name="title" className="jo-input" placeholder="Service Agreement" required />
            </div>
            <div>
              <label className="jo-label" htmlFor="content">Contract text</label>
              <textarea
                id="content"
                name="content"
                className="jo-textarea"
                rows={12}
                placeholder={'Section title:\nParagraph text…\n\nAnother section:\nMore terms…'}
              />
              <p className="jo-caption" style={{ margin: '6px 0 0' }}>
                Lines ending with “:” become section titles. Blank lines split paragraphs.
              </p>
            </div>
            <div>
              <button type="submit" className="jo-btn jo-btn-primary" disabled={pending}>
                Continue to prepare <Icon name="chevronRight" size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  onClick,
  busy,
  style,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  busy: boolean;
  style: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...style,
        borderColor: hover ? 'var(--jo-border-strong)' : 'var(--jo-border)',
        boxShadow: hover ? 'var(--jo-shadow-md)' : 'none',
        transform: hover ? 'translateY(-2px)' : 'none',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--jo-surface)', display: 'grid', placeItems: 'center', color: 'var(--jo-fg)' }}>
        <Icon name={icon} size={18} />
      </span>
      <span style={{ font: '600 15px var(--jo-font-sans)' }}>{title}</span>
      <span className="jo-caption">{description}</span>
    </button>
  );
}
