import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface VerifyProps {
  params: Promise<{ id: string }>;
}

/**
 * Verificación pública de integridad: cualquier tercero con el ID puede
 * comprobar el estado, el hash SHA-256 y la línea de tiempo de firmas.
 * No expone el contenido del documento.
 */
export default async function VerifyPage({ params }: VerifyProps) {
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      signers: { orderBy: { slot: 'asc' } },
      owner: { select: { name: true } },
    },
  });
  if (!doc || doc.status === 'DRAFT') notFound();

  const fmt = (d: Date | null) =>
    d ? d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : '—';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--jo-surface)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 6px' }}>
          Document verification
        </p>
        <h1 className="jo-h1" style={{ margin: '0 0 4px' }}>{doc.title}</h1>
        <p className="jo-caption" style={{ margin: '0 0 20px' }}>
          Sent by {doc.owner.name} · ID <span style={{ fontFamily: 'monospace' }}>{doc.id}</span>
        </p>

        <div className="jo-card" style={{ padding: 24, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge status={doc.status} />
            <span className="jo-caption">
              {doc.status === 'SIGNED'
                ? 'All parties signed this document.'
                : doc.status === 'DECLINED'
                  ? 'A party declined to sign.'
                  : doc.status === 'VOIDED'
                    ? 'The sender voided this document.'
                    : doc.status === 'EXPIRED'
                      ? 'The signing window expired.'
                      : 'Signing is in progress.'}
            </span>
          </div>

          <div>
            <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 8px' }}>
              Signers
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {doc.signers.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ font: '500 13px var(--jo-font-sans)' }}>
                    {s.slot}. {s.name}
                  </span>
                  <span className="jo-caption">
                    {s.signedAt ? `signed ${fmt(s.signedAt)}` : s.declinedAt ? 'declined' : 'pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {doc.contentHash && (
            <div>
              <p className="jo-micro" style={{ textTransform: 'uppercase', color: 'var(--jo-fg-tertiary)', margin: '0 0 6px' }}>
                Content fingerprint (SHA-256, computed when sent)
              </p>
              <code style={{ font: '400 11px monospace', wordBreak: 'break-all', color: 'var(--jo-fg-secondary)' }}>
                {doc.contentHash}
              </code>
              <p className="jo-caption" style={{ margin: '8px 0 0' }}>
                If someone alters the contract text after sending, its fingerprint will no longer
                match this value.
              </p>
            </div>
          )}
        </div>

        <p className="jo-caption" style={{ textAlign: 'center', marginTop: 20, color: 'var(--jo-fg-tertiary)' }}>
          Joansaro Contracts — demo verification page. Document content is never shown here.
        </p>
      </div>
    </div>
  );
}
