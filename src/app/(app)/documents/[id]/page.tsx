import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureNotExpired } from '@/lib/actions';
import { Badge, ContractBody, FieldContent } from '@/components/ui';
import { Icon } from '@/components/icons';
import { DetailActions, SignerRow } from './detail-actions';

export const dynamic = 'force-dynamic';

const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  completed: 'Completed',
  declined: 'Declined',
  reminder: 'Reminder',
  voided: 'Voided',
  expired: 'Expired',
};

interface DetailProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: DetailProps) {
  const user = await requireUser();
  const { id } = await params;
  const doc = await db.document.findFirst({
    where: { id, ownerId: user.id },
    include: {
      fields: true,
      signers: { orderBy: { slot: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!doc) notFound();

  // Expiración perezosa: si venció, el estado real es EXPIRED
  const status = await ensureNotExpired(doc);

  // Turno activo (para señalar a quién le toca en secuencial)
  const pendingSlots = doc.signers.filter((s) => !s.signedAt && !s.declinedAt).map((s) => s.slot);
  const activeSlot =
    doc.signingOrder === 'sequential' && pendingSlots.length > 0 ? Math.min(...pendingSlots) : null;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/dashboard" className="jo-btn jo-btn-ghost jo-btn-sm">
          <Icon name="chevronLeft" size={14} /> Documents
        </Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="jo-h1" style={{ margin: '0 0 6px' }}>{doc.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Badge status={status} />
            {doc.signers.length > 0 && (
              <span className="jo-caption">
                {doc.signers.filter((s) => s.signedAt).length}/{doc.signers.length} signed ·{' '}
                {doc.signingOrder === 'sequential' ? 'in order' : 'any order'}
              </span>
            )}
            {doc.expiresAt && ['SENT', 'PARTIALLY_SIGNED'].includes(status) && (
              <span className="jo-caption">
                expires {doc.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <DetailActions documentId={doc.id} status={status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Document preview */}
        <div className="jo-doc-page">
          {doc.sourceType === 'pdf' && doc.pdfPath ? (
            <iframe
              src={`${doc.pdfPath}#toolbar=0&navpanes=0`}
              title={doc.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="jo-doc-inner">
              <ContractBody content={doc.content} />
            </div>
          )}
          {doc.fields
            .filter((f) => f.page === 1)
            .map((f) => (
              <div
                key={f.id}
                className={`jo-field-box${f.value ? ' filled' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
              >
                <FieldContent type={f.type} value={f.value} />
              </div>
            ))}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Signers */}
          {doc.signers.length > 0 && (
            <div className="jo-card" style={{ padding: 20 }}>
              <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 12px' }}>
                Signers
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {doc.signers.map((s) => (
                  <SignerRow
                    key={s.id}
                    documentId={doc.id}
                    signer={{
                      id: s.id,
                      slot: s.slot,
                      name: s.name,
                      email: s.email,
                      token: s.token,
                      viewedAt: s.viewedAt?.toISOString() ?? null,
                      signedAt: s.signedAt?.toISOString() ?? null,
                      declinedAt: s.declinedAt?.toISOString() ?? null,
                      declineNote: s.declineNote,
                    }}
                    isActiveTurn={activeSlot === s.slot && ['SENT', 'PARTIALLY_SIGNED'].includes(status)}
                    docOpen={['SENT', 'PARTIALLY_SIGNED'].includes(status)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="jo-card" style={{ padding: 20 }}>
            <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 14px' }}>
              Activity
            </p>
            <div>
              {doc.events.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 9999,
                        marginTop: 4,
                        flexShrink: 0,
                        background:
                          e.type === 'signed' || e.type === 'completed'
                            ? 'var(--jo-success)'
                            : e.type === 'declined' || e.type === 'voided' || e.type === 'expired'
                              ? 'var(--jo-danger)'
                              : 'var(--jo-fg)',
                      }}
                    />
                    {i < doc.events.length - 1 && (
                      <span style={{ width: 1, flex: 1, background: 'var(--jo-border)', margin: '4px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < doc.events.length - 1 ? 16 : 0 }}>
                    <div style={{ font: '500 13px var(--jo-font-sans)' }}>{EVENT_LABEL[e.type] ?? e.type}</div>
                    {e.detail && <div className="jo-caption">{e.detail}</div>}
                    <div className="jo-caption" style={{ color: 'var(--jo-fg-tertiary)' }}>
                      {e.createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="jo-card" style={{ padding: 20 }}>
            <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 10px' }}>
              Details
            </p>
            <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
              <Row label="Source" value={doc.sourceType === 'pdf' ? 'Uploaded PDF' : doc.sourceType === 'template' ? 'Template' : 'Blank'} />
              <Row label="Fields" value={String(doc.fields.length)} />
              <Row label="Created" value={doc.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              {doc.contentHash && <Row label="SHA-256" value={`${doc.contentHash.slice(0, 18)}…`} />}
            </dl>
            {doc.contentHash && (
              <Link href={`/verify/${doc.id}`} className="jo-btn jo-btn-secondary jo-btn-sm" style={{ marginTop: 12, width: '100%' }} target="_blank">
                <Icon name="check" size={14} /> Public verification page
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <dt className="jo-caption" style={{ margin: 0 }}>{label}</dt>
      <dd style={{ margin: 0, font: '500 13px var(--jo-font-sans)' }}>{value}</dd>
    </div>
  );
}
