'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { declineAction, markViewedAction, submitSignatureAction } from '@/lib/actions';
import { Icon } from '@/components/icons';
import { ContractBody, FieldContent } from '@/components/ui';

interface SignerField {
  id: string;
  type: 'signature' | 'date' | 'text' | 'checkbox';
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  value: string | null;
}

interface DocInfo {
  title: string;
  content: string;
  sourceType: string;
  pdfPath: string | null;
}

type Step = 'welcome' | 'review' | 'done' | 'declined';

export interface ReadonlyField {
  id: string;
  type: 'signature' | 'date' | 'text' | 'checkbox';
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
  value: string | null;
}

export function SignerFlow(props: {
  token: string;
  signerName: string;
  senderName: string;
  message: string | null;
  alreadySigned: boolean;
  declined: boolean;
  blocked: 'voided' | 'expired' | 'declined-other' | null;
  waitingFor: string | null;
  totalSigners: number;
  slot: number;
  doc: DocInfo;
  fields: SignerField[];
  otherFields: ReadonlyField[];
}) {
  const { token, signerName, senderName, message, doc, fields, otherFields, blocked, waitingFor } = props;
  const [step, setStep] = useState<Step>(
    props.alreadySigned ? 'done' : props.declined ? 'declined' : 'welcome',
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) if (f.value) v[f.id] = f.value;
    return v;
  });
  const [sigModal, setSigModal] = useState<string | null>(null); // field id being signed
  const [textModal, setTextModal] = useState<string | null>(null); // field id being typed
  const [declineOpen, setDeclineOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (step === 'welcome') void markViewedAction(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = useMemo(
    () => fields.filter((f) => f.required && !values[f.id]).length,
    [fields, values],
  );

  const setField = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitSignatureAction(token, values);
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong');
        return;
      }
      setStep('done');
    });
  };

  const decline = (note: string) => {
    startTransition(async () => {
      const res = await declineAction(token, note);
      if (res.ok) setStep('declined');
    });
  };

  // ---------- Screens ----------

  // ---------- Blocked states: voided / expired / waiting turn ----------
  if (blocked === 'voided') {
    return (
      <CenterShell>
        <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>Document voided</h1>
        <p className="jo-body" style={{ color: 'var(--jo-fg-secondary)' }}>
          {senderName} has voided \u201C{doc.title}\u201D. No action is needed on your side.
        </p>
      </CenterShell>
    );
  }
  if (blocked === 'expired') {
    return (
      <CenterShell>
        <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>Link expired</h1>
        <p className="jo-body" style={{ color: 'var(--jo-fg-secondary)' }}>
          The signing window for \u201C{doc.title}\u201D has closed. Ask {senderName} to send you a new link.
        </p>
      </CenterShell>
    );
  }
  if (blocked === 'declined-other') {
    return (
      <CenterShell>
        <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>Signing stopped</h1>
        <p className="jo-body" style={{ color: 'var(--jo-fg-secondary)' }}>
          Another party declined \u201C{doc.title}\u201D, so it is no longer open for signing.
        </p>
      </CenterShell>
    );
  }
  if (waitingFor) {
    return (
      <CenterShell>
        <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>Not your turn yet</h1>
        <p className="jo-body" style={{ color: 'var(--jo-fg-secondary)' }}>
          \u201C{doc.title}\u201D is being signed in order. We are waiting for <strong>{waitingFor}</strong> to
          sign first \u2014 you will get an email as soon as it is your turn.
        </p>
      </CenterShell>
    );
  }


  if (step === 'welcome') {
    return (
      <CenterShell>
        <div className="jo-card" style={{ padding: 40, textAlign: 'center', maxWidth: 480 }}>
          <span style={{ width: 48, height: 48, borderRadius: 9999, background: 'var(--jo-surface)', display: 'inline-grid', placeItems: 'center', marginBottom: 16 }}>
            <Icon name="fileText" size={22} />
          </span>
          <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>
            {senderName} sent you a document to sign
          </h1>
          <p className="jo-body-l" style={{ margin: '0 0 4px', color: 'var(--jo-fg-secondary)' }}>{doc.title}</p>
          <p className="jo-caption" style={{ margin: 0 }}>For: {signerName}</p>
          {message && (
            <blockquote
              style={{
                margin: '20px 0 0',
                padding: '12px 16px',
                background: 'var(--jo-surface)',
                borderRadius: 8,
                font: '400 14px/20px var(--jo-font-sans)',
                color: 'var(--jo-fg-secondary)',
                textAlign: 'left',
              }}
            >
              “{message}”
            </blockquote>
          )}
          <div style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="jo-btn jo-btn-primary jo-btn-lg" onClick={() => setStep('review')}>
              Review & sign <Icon name="chevronRight" size={15} />
            </button>
          </div>
          <p className="jo-caption" style={{ marginTop: 20 }}>
            <Icon name="shield" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Secured by Joansaro · Demo environment
          </p>
        </div>
      </CenterShell>
    );
  }

  if (step === 'done') {
    return (
      <CenterShell>
        <div className="jo-card" style={{ padding: 40, textAlign: 'center', maxWidth: 440 }}>
          <span style={{ width: 56, height: 56, borderRadius: 9999, background: '#F0FDF4', color: 'var(--jo-success)', display: 'inline-grid', placeItems: 'center', marginBottom: 16 }}>
            <Icon name="check" size={26} />
          </span>
          <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>You’re all set</h1>
          <p className="jo-body" style={{ margin: 0, color: 'var(--jo-fg-secondary)' }}>
            “{doc.title}” has been signed. {senderName} has been notified.
          </p>
          <a href={`/api/sign/${token}/pdf`} className="jo-btn jo-btn-primary" download style={{ marginTop: 20 }}>
            <Icon name="download" size={15} /> Download signed copy
          </a>
        </div>
      </CenterShell>
    );
  }

  if (step === 'declined') {
    return (
      <CenterShell>
        <div className="jo-card" style={{ padding: 40, textAlign: 'center', maxWidth: 440 }}>
          <span style={{ width: 56, height: 56, borderRadius: 9999, background: '#FEF2F2', color: 'var(--jo-danger)', display: 'inline-grid', placeItems: 'center', marginBottom: 16 }}>
            <Icon name="x" size={26} />
          </span>
          <h1 className="jo-h1" style={{ margin: '0 0 8px' }}>Document declined</h1>
          <p className="jo-body" style={{ margin: 0, color: 'var(--jo-fg-secondary)' }}>
            {senderName} has been notified that you declined to sign “{doc.title}”.
          </p>
        </div>
      </CenterShell>
    );
  }

  // ---------- Review & fill ----------
  return (
    <div style={{ minHeight: '100vh', background: '#F0F0F0', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          height: 56,
          background: '#fff',
          borderBottom: '1px solid var(--jo-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '600 14px var(--jo-font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
          <div className="jo-caption">From {senderName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="jo-caption">
            {remaining === 0 ? 'All fields complete' : `${remaining} required ${remaining === 1 ? 'field' : 'fields'} left`}
          </span>
          <button type="button" className="jo-btn jo-btn-secondary jo-btn-sm" onClick={() => setDeclineOpen(true)} disabled={pending}>
            Decline
          </button>
          <button type="button" className="jo-btn jo-btn-primary jo-btn-sm" onClick={finish} disabled={pending || remaining > 0}>
            {pending ? 'Finishing…' : 'Finish signing'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ margin: '16px auto 0', maxWidth: 816, width: '100%', padding: '10px 12px', borderRadius: 6, background: '#FEF2F2', color: 'var(--jo-danger)', font: '400 13px var(--jo-font-sans)' }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, padding: 32 }}>
        <div className="jo-doc-page">
          {doc.sourceType === 'pdf' && doc.pdfPath ? (
            <iframe
              src={`${doc.pdfPath}#toolbar=0&navpanes=0`}
              title={doc.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
            />
          ) : (
            <div className="jo-doc-inner">
              <ContractBody content={doc.content} />
            </div>
          )}

          {otherFields
            .filter((f) => f.page === 1)
            .map((f) => (
              <div
                key={f.id}
                className={`jo-field-box${f.value ? ' filled' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%`, opacity: 0.65 }}
                title="Assigned to another signer"
              >
                <FieldContent type={f.type} value={f.value} />
              </div>
            ))}

          {fields.map((f) => {
            const filled = Boolean(values[f.id]);
            return (
              <button
                key={f.id}
                type="button"
                className={`jo-field-box ${filled ? 'filled' : 'fillable'}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
                onClick={() => {
                  if (f.type === 'signature') setSigModal(f.id);
                  else if (f.type === 'date') setField(f.id, new Date().toLocaleDateString('en-US'));
                  else if (f.type === 'checkbox') setField(f.id, values[f.id] ? '' : 'checked');
                  else setTextModal(f.id);
                }}
              >
                <FieldContent type={f.type} value={values[f.id] ?? null} />
              </button>
            );
          })}
        </div>
      </div>

      {sigModal && (
        <SignatureModal
          signerName={signerName}
          onCancel={() => setSigModal(null)}
          onApply={(value) => {
            setField(sigModal, value);
            setSigModal(null);
          }}
        />
      )}

      {textModal && (
        <TextFieldModal
          initial={values[textModal] ?? ''}
          onCancel={() => setTextModal(null)}
          onApply={(value) => {
            setField(textModal, value);
            setTextModal(null);
          }}
        />
      )}

      {declineOpen && (
        <DeclineModal
          docTitle={doc.title}
          pending={pending}
          onCancel={() => setDeclineOpen(false)}
          onConfirm={(note) => {
            setDeclineOpen(false);
            decline(note);
          }}
        />
      )}
    </div>
  );
}

function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--jo-surface)', padding: 24 }}>
      {children}
    </main>
  );
}

// ============================== SIGNATURE MODAL ==============================

const FONTS = [
  { id: 'var(--jo-font-script-1)', label: 'Caveat' },
  { id: 'var(--jo-font-script-2)', label: 'Dancing Script' },
  { id: 'var(--jo-font-script-3)', label: 'Allura' },
];

function SignatureModal({
  signerName,
  onCancel,
  onApply,
}: {
  signerName: string;
  onCancel: () => void;
  onApply: (value: string) => void;
}) {
  const [tab, setTab] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState(signerName);
  const [font, setFont] = useState(FONTS[1]!.id);
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0A0A0A';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [tab]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    setHasStrokes(true);
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const apply = () => {
    if (tab === 'draw') {
      if (!hasStrokes) return;
      onApply(JSON.stringify({ kind: 'draw', dataUrl: canvasRef.current!.toDataURL('image/png') }));
    } else {
      if (!typed.trim()) return;
      onApply(JSON.stringify({ kind: 'typed', text: typed.trim(), font }));
    }
  };

  return (
    <div className="jo-overlay" onClick={onCancel}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="jo-h2">Add your signature</span>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={onCancel} aria-label="Close" style={{ padding: '0 8px' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--jo-border)', padding: '8px 24px 0' }}>
          {(['draw', 'type'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '10px 0',
                border: 'none',
                background: 'transparent',
                font: '500 14px var(--jo-font-sans)',
                color: tab === t ? 'var(--jo-fg)' : 'var(--jo-fg-secondary)',
                borderBottom: `2px solid ${tab === t ? 'var(--jo-accent)' : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
              }}
            >
              {t === 'draw' ? 'Draw' : 'Type'}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'draw' ? (
            <div>
              <div style={{ position: 'relative' }}>
                <canvas
                  ref={canvasRef}
                  style={{
                    width: '100%',
                    height: 180,
                    background: '#fff',
                    border: '1px solid var(--jo-border)',
                    borderRadius: 8,
                    touchAction: 'none',
                    cursor: 'crosshair',
                    display: 'block',
                  }}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerLeave={up}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: 24,
                    right: 24,
                    bottom: 42,
                    borderBottom: '1px dashed var(--jo-border-strong)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span className="jo-caption">Draw your signature above the line.</span>
                <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={clear}>
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <input className="jo-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your full name" />
              <div style={{ display: 'grid', gap: 8 }}>
                {FONTS.map((f) => (
                  <label
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      border: `1px solid ${font === f.id ? 'var(--jo-accent)' : 'var(--jo-border)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'var(--jo-transition)',
                    }}
                  >
                    <input type="radio" name="sigfont" checked={font === f.id} onChange={() => setFont(f.id)} style={{ accentColor: '#18181B' }} />
                    <span style={{ fontFamily: f.id, fontSize: 30, lineHeight: 1.1 }}>{typed || 'Your name'}</span>
                    <span className="jo-caption" style={{ marginLeft: 'auto' }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="jo-btn jo-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="jo-btn jo-btn-primary" onClick={apply} disabled={tab === 'draw' ? !hasStrokes : !typed.trim()}>
              <Icon name="check" size={14} /> Apply signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================== TEXT FIELD MODAL ==============================

function TextFieldModal({
  initial,
  onCancel,
  onApply,
}: {
  initial: string;
  onCancel: () => void;
  onApply: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <div className="jo-overlay" onClick={onCancel}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--jo-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="jo-h2">Fill in text</span>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={onCancel} aria-label="Close" style={{ padding: '0 8px' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onApply(value.trim());
          }}
          style={{ padding: 24, display: 'grid', gap: 16 }}
        >
          <input
            className="jo-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type here…"
            autoFocus
            maxLength={300}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="jo-btn jo-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="jo-btn jo-btn-primary">
              <Icon name="check" size={14} /> Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================== DECLINE MODAL ==============================

function DeclineModal({
  docTitle,
  pending,
  onCancel,
  onConfirm,
}: {
  docTitle: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="jo-overlay" onClick={onCancel}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--jo-border)' }}>
          <span className="jo-h2">Decline to sign?</span>
          <p className="jo-caption" style={{ margin: '4px 0 0' }}>
            The sender will be notified that you declined “{docTitle}”. This cannot be undone.
          </p>
        </div>
        <div style={{ padding: 24, display: 'grid', gap: 16 }}>
          <div>
            <label className="jo-label" htmlFor="decline-note">Reason (optional)</label>
            <textarea
              id="decline-note"
              className="jo-textarea"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Let the sender know why…"
              maxLength={500}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="jo-btn jo-btn-secondary" onClick={onCancel}>Keep reviewing</button>
            <button
              type="button"
              className="jo-btn"
              style={{ background: 'var(--jo-danger)', color: '#fff' }}
              disabled={pending}
              onClick={() => onConfirm(note)}
            >
              Decline document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
