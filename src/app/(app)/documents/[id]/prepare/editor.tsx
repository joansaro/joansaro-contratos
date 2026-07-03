'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveFieldsAction, sendForSignatureAction, updateContentAction, type FormState } from '@/lib/actions';
import { Icon } from '@/components/icons';
import { ContractBody } from '@/components/ui';

type FieldType = 'signature' | 'date' | 'text' | 'checkbox';

interface EditorField {
  type: FieldType;
  x: number; // % of page width
  y: number; // % of page height
  w: number;
  h: number;
}

interface DocInfo {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  pdfPath: string | null;
}

const PALETTE: { type: FieldType; icon: string; label: string; w: number; h: number }[] = [
  { type: 'signature', icon: 'penLine', label: 'Signature', w: 26, h: 6.5 },
  { type: 'date', icon: 'calendar', label: 'Date', w: 18, h: 4.5 },
  { type: 'text', icon: 'type', label: 'Text', w: 24, h: 4.5 },
  { type: 'checkbox', icon: 'checkSquare', label: 'Checkbox', w: 4, h: 3 },
];

export function PrepareEditor({ doc, initialFields }: { doc: DocInfo; initialFields: EditorField[] }) {
  const router = useRouter();
  const [fields, setFields] = useState<EditorField[]>(initialFields);
  const [tool, setTool] = useState<FieldType | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ index: number; startW: number; startH: number; px: number; py: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [docTitle, setDocTitle] = useState(doc.title);
  const [docContent, setDocContent] = useState(doc.content);

  const mutate = (next: EditorField[]) => {
    setFields(next);
    setDirty(true);
  };

  const placeAt = (e: React.MouseEvent) => {
    if (!tool || !pageRef.current) {
      setSelected(null);
      return;
    }
    const spec = PALETTE.find((p) => p.type === tool)!;
    const rect = pageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100 - spec.w / 2;
    const y = ((e.clientY - rect.top) / rect.height) * 100 - spec.h / 2;
    mutate([
      ...fields,
      {
        type: tool,
        x: Math.min(Math.max(x, 0), 100 - spec.w),
        y: Math.min(Math.max(y, 0), 100 - spec.h),
        w: spec.w,
        h: spec.h,
      },
    ]);
    setSelected(fields.length);
    setTool(null);
  };

  const startDrag = (index: number, e: React.PointerEvent) => {
    if (!pageRef.current) return;
    e.stopPropagation();
    setSelected(index);
    const rect = pageRef.current.getBoundingClientRect();
    const f = fields[index]!;
    dragRef.current = {
      index,
      dx: ((e.clientX - rect.left) / rect.width) * 100 - f.x,
      dy: ((e.clientY - rect.top) / rect.height) * 100 - f.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResize = (index: number, e: React.PointerEvent) => {
    if (!pageRef.current) return;
    e.stopPropagation();
    const rect = pageRef.current.getBoundingClientRect();
    const f = fields[index]!;
    resizeRef.current = {
      index,
      startW: f.w,
      startH: f.h,
      px: ((e.clientX - rect.left) / rect.width) * 100,
      py: ((e.clientY - rect.top) / rect.height) * 100,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResize = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * 100;
    const cy = ((e.clientY - rect.top) / rect.height) * 100;
    const f = fields[r.index]!;
    const next = fields.slice();
    next[r.index] = {
      ...f,
      w: Math.min(Math.max(r.startW + (cx - r.px), 3), 100 - f.x),
      h: Math.min(Math.max(r.startH + (cy - r.py), 2), 100 - f.y),
    };
    mutate(next);
  };

  const onDrag = (e: React.PointerEvent) => {
    if (resizeRef.current) return onResize(e);
    const drag = dragRef.current;
    if (!drag || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const f = fields[drag.index]!;
    const x = ((e.clientX - rect.left) / rect.width) * 100 - drag.dx;
    const y = ((e.clientY - rect.top) / rect.height) * 100 - drag.dy;
    const next = fields.slice();
    next[drag.index] = {
      ...f,
      x: Math.min(Math.max(x, 0), 100 - f.w),
      y: Math.min(Math.max(y, 0), 100 - f.h),
    };
    mutate(next);
  };

  const endDrag = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  const removeSelected = () => {
    if (selected === null) return;
    mutate(fields.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const save = (after?: () => void) => {
    setSaveError(null);
    startSaving(async () => {
      const res = await saveFieldsAction(doc.id, fields);
      if (!res.ok) {
        setSaveError(res.error ?? 'Could not save');
        return;
      }
      setDirty(false);
      after?.();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <header
        style={{
          height: 56,
          borderBottom: '1px solid var(--jo-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 20px',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <Link href={`/documents/${doc.id}`} className="jo-btn jo-btn-ghost jo-btn-sm">
          <Icon name="chevronLeft" size={14} /> Back
        </Link>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '600 14px var(--jo-font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {docTitle}
          </div>
          <div className="jo-caption">Prepare document</div>
        </div>
        {doc.sourceType !== 'pdf' && (
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={() => setEditOpen(true)}>
            <Icon name="type" size={14} /> Edit text
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveError && <span className="jo-field-error" style={{ margin: 0 }}>{saveError}</span>}
          <button type="button" className="jo-btn jo-btn-secondary jo-btn-sm" onClick={() => save()} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left panel: palette */}
        <aside
          style={{
            width: 232,
            flexShrink: 0,
            borderRight: '1px solid var(--jo-border)',
            background: 'var(--jo-surface)',
            padding: 20,
            overflowY: 'auto',
          }}
        >
          <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 10px' }}>
            Fields
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            {PALETTE.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => setTool(tool === p.type ? null : p.type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: `1px solid ${tool === p.type ? 'var(--jo-accent)' : 'var(--jo-border)'}`,
                  background: tool === p.type ? '#fff' : '#fff',
                  boxShadow: tool === p.type ? 'var(--jo-focus-ring, 0 0 0 1px var(--jo-accent))' : 'none',
                  font: '500 13px var(--jo-font-sans)',
                  cursor: 'pointer',
                  transition: 'var(--jo-transition)',
                }}
              >
                <Icon name={p.icon} size={15} />
                {p.label}
              </button>
            ))}
          </div>

          <p className="jo-caption" style={{ marginTop: 16 }}>
            {tool
              ? 'Now click on the document to place the field.'
              : 'Tip: pick a field, then click on the document to place it. Drag to move.'}
          </p>

          {selected !== null && (
            <button type="button" className="jo-btn jo-btn-danger jo-btn-sm" onClick={removeSelected} style={{ marginTop: 12, width: '100%' }}>
              <Icon name="trash" size={14} /> Remove field
            </button>
          )}
        </aside>

        {/* Document canvas */}
        <div style={{ flex: 1, overflow: 'auto', background: '#F0F0F0', padding: 32 }}>
          <div
            ref={pageRef}
            className="jo-doc-page"
            onClick={placeAt}
            style={{ cursor: tool ? 'crosshair' : 'default' }}
          >
            {doc.sourceType === 'pdf' && doc.pdfPath ? (
              <iframe
                src={`${doc.pdfPath}#toolbar=0&navpanes=0`}
                title={doc.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
              />
            ) : (
              <div className="jo-doc-inner">
                <ContractBody content={docContent} />
              </div>
            )}

            {fields.map((f, i) => (
              <div
                key={i}
                className={`jo-field-box${selected === i ? ' selected' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%`, cursor: 'move', touchAction: 'none' }}
                onPointerDown={(e) => startDrag(i, e)}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name={PALETTE.find((p) => p.type === f.type)!.icon} size={13} />
                {f.type !== 'checkbox' && PALETTE.find((p) => p.type === f.type)!.label}
                {selected === i && (
                  <span
                    onPointerDown={(e) => startResize(i, e)}
                    onPointerMove={onDrag}
                    onPointerUp={endDrag}
                    style={{
                      position: 'absolute',
                      right: -6,
                      bottom: -6,
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: 'var(--jo-accent)',
                      border: '2px solid #fff',
                      boxShadow: 'var(--jo-shadow-sm)',
                      cursor: 'nwse-resize',
                      touchAction: 'none',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <footer
        style={{
          height: 60,
          borderTop: '1px solid var(--jo-border)',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <span className="jo-caption">
          {fields.length} {fields.length === 1 ? 'field' : 'fields'} placed
          {fields.length > 0 && ' · Ready to send'}
        </span>
        <button
          type="button"
          className="jo-btn jo-btn-primary"
          disabled={fields.length === 0 || saving}
          onClick={() => save(() => setSendOpen(true))}
        >
          <Icon name="send" size={15} /> Send for signature
        </button>
      </footer>

      {editOpen && (
        <EditTextModal
          documentId={doc.id}
          title={docTitle}
          content={docContent}
          onCancel={() => setEditOpen(false)}
          onSaved={(t, c) => {
            setDocTitle(t);
            setDocContent(c);
            setEditOpen(false);
          }}
        />
      )}

      {sendOpen && (
        <SendModal
          documentId={doc.id}
          onClose={() => setSendOpen(false)}
          onSent={() => router.push(`/documents/${doc.id}`)}
        />
      )}
    </div>
  );
}

// ============================== SEND MODAL ==============================

function SendModal({
  documentId,
  onClose,
  onSent,
}: {
  documentId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const action = (prev: FormState & { link?: string }, fd: FormData) =>
    sendForSignatureAction(documentId, prev, fd);
  const [state, formAction, pending] = useActionState<FormState & { link?: string }, FormData>(action, {});
  const [copied, setCopied] = useState(false);

  const link = state.link ? `${window.location.origin}${state.link}` : null;

  return (
    <div className="jo-overlay" onClick={onClose}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--jo-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="jo-h2">Send for signature</span>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={onClose} aria-label="Close" style={{ padding: '0 8px' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {link ? (
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 9999, background: '#F0FDF4', color: 'var(--jo-success)', display: 'grid', placeItems: 'center' }}>
                <Icon name="check" size={18} />
              </span>
              <div>
                <div style={{ font: '600 14px var(--jo-font-sans)' }}>Document sent</div>
                <div className="jo-caption">Share this signing link with your client (demo — no email is sent).</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="jo-input" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="jo-btn jo-btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Icon name="copy" size={14} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div>
              <button type="button" className="jo-btn jo-btn-primary" onClick={onSent}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form action={formAction} style={{ padding: 24, display: 'grid', gap: 16 }}>
            {state.error && (
              <div style={{ padding: '10px 12px', borderRadius: 6, background: '#FEF2F2', color: 'var(--jo-danger)', font: '400 13px var(--jo-font-sans)' }}>
                {state.error}
              </div>
            )}
            <div>
              <label className="jo-label" htmlFor="s-name">Signer name</label>
              <input id="s-name" name="name" className="jo-input" placeholder="Sarah Johnson" required />
            </div>
            <div>
              <label className="jo-label" htmlFor="s-email">Signer email</label>
              <input id="s-email" name="email" type="email" className="jo-input" placeholder="sarah@example.com" required />
            </div>
            <div>
              <label className="jo-label" htmlFor="s-msg">Message (optional)</label>
              <textarea id="s-msg" name="message" className="jo-textarea" rows={3} placeholder="Hi Sarah — please review and sign when you have a moment." />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="jo-btn jo-btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="jo-btn jo-btn-primary" disabled={pending}>
                <Icon name="send" size={14} /> {pending ? 'Sending…' : 'Send document'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================== EDIT TEXT MODAL ==============================

function EditTextModal({
  documentId,
  title,
  content,
  onCancel,
  onSaved,
}: {
  documentId: string;
  title: string;
  content: string;
  onCancel: () => void;
  onSaved: (title: string, content: string) => void;
}) {
  const [t, setT] = useState(title);
  const [c, setC] = useState(content);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateContentAction(documentId, t, c);
      if (!res.ok) {
        setError(res.error ?? 'Could not save');
        return;
      }
      onSaved(t.trim() || title, c);
    });
  };

  return (
    <div className="jo-overlay" onClick={onCancel}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--jo-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="jo-h2">Edit contract text</span>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={onCancel} aria-label="Close" style={{ padding: '0 8px' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: 24, display: 'grid', gap: 16 }}>
          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 6, background: '#FEF2F2', color: 'var(--jo-danger)', font: '400 13px var(--jo-font-sans)' }}>
              {error}
            </div>
          )}
          <div>
            <label className="jo-label" htmlFor="edit-title">Title</label>
            <input id="edit-title" className="jo-input" value={t} onChange={(e) => setT(e.target.value)} maxLength={160} />
          </div>
          <div>
            <label className="jo-label" htmlFor="edit-content">Contract text</label>
            <textarea id="edit-content" className="jo-textarea" rows={14} value={c} onChange={(e) => setC(e.target.value)} />
            <p className="jo-caption" style={{ margin: '6px 0 0' }}>
              Lines ending with “:” become section titles. Blank lines split paragraphs.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="jo-btn jo-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="jo-btn jo-btn-primary" onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
