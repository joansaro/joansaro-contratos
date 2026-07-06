import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { ensureNotExpired } from '@/lib/actions';
import { SignerFlow } from './signer-flow';

export const dynamic = 'force-dynamic';

interface SignPageProps {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: SignPageProps) {
  const { token } = await params;
  const signer = await db.signer.findUnique({
    where: { token },
    include: {
      document: {
        include: { fields: true, signers: true, owner: { select: { name: true } } },
      },
    },
  });
  if (!signer) notFound();

  const doc = signer.document;
  const status = await ensureNotExpired(doc);

  // Turno secuencial: ¿le toca a este firmante?
  const pending = doc.signers.filter((sg) => !sg.signedAt && !sg.declinedAt);
  const activeSlot = pending.length > 0 ? Math.min(...pending.map((sg) => sg.slot)) : null;
  const waitingFor =
    doc.signingOrder === 'sequential' && activeSlot !== null && signer.slot !== activeSlot && !signer.signedAt
      ? doc.signers.find((sg) => sg.slot === activeSlot)?.name ?? null
      : null;

  // Estado bloqueante del documento (más allá del propio firmante)
  const blocked =
    status === 'VOIDED'
      ? ('voided' as const)
      : status === 'EXPIRED'
        ? ('expired' as const)
        : status === 'DECLINED' && !signer.declinedAt
          ? ('declined-other' as const)
          : null;

  return (
    <SignerFlow
      token={token}
      signerName={signer.name}
      senderName={doc.owner.name}
      message={signer.message}
      alreadySigned={Boolean(signer.signedAt)}
      declined={Boolean(signer.declinedAt)}
      blocked={blocked}
      waitingFor={waitingFor}
      totalSigners={doc.signers.length}
      slot={signer.slot}
      doc={{
        title: doc.title,
        content: doc.content,
        sourceType: doc.sourceType,
        pdfPath: doc.pdfPath,
      }}
      fields={doc.fields
        .filter((f) => f.slot === signer.slot)
        .map((f) => ({
          id: f.id,
          type: f.type as 'signature' | 'date' | 'text' | 'checkbox',
          x: f.x,
          y: f.y,
          w: f.w,
          h: f.h,
          page: f.page,
          required: f.required,
          value: f.value,
        }))}
      otherFields={doc.fields
        .filter((f) => f.slot !== signer.slot)
        .map((f) => ({
          id: f.id,
          type: f.type as 'signature' | 'date' | 'text' | 'checkbox',
          x: f.x,
          y: f.y,
          w: f.w,
          h: f.h,
          page: f.page,
          value: f.value,
        }))}
    />
  );
}
