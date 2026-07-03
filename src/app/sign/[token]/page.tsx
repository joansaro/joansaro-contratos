import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
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
      document: { include: { fields: true, owner: { select: { name: true } } } },
    },
  });
  if (!signer) notFound();

  const doc = signer.document;

  return (
    <SignerFlow
      token={token}
      signerName={signer.name}
      senderName={doc.owner.name}
      message={signer.message}
      alreadySigned={Boolean(signer.signedAt)}
      declined={Boolean(signer.declinedAt)}
      doc={{
        title: doc.title,
        content: doc.content,
        sourceType: doc.sourceType,
        pdfPath: doc.pdfPath,
      }}
      fields={doc.fields.map((f) => ({
        id: f.id,
        type: f.type as 'signature' | 'date' | 'text' | 'checkbox',
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        required: f.required,
        value: f.value,
      }))}
    />
  );
}
