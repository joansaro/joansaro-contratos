import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PrepareEditor } from './editor';

export const dynamic = 'force-dynamic';

interface PreparePageProps {
  params: Promise<{ id: string }>;
}

export default async function PreparePage({ params }: PreparePageProps) {
  const user = await requireUser();
  const { id } = await params;
  const doc = await db.document.findFirst({
    where: { id, ownerId: user.id },
    include: { fields: true },
  });
  if (!doc) notFound();
  if (doc.status !== 'DRAFT') redirect(`/documents/${doc.id}`);

  // Contactos del dueño para autocompletar el envío
  const contacts = await db.contact.findMany({
    where: { ownerId: user.id },
    orderBy: { name: 'asc' },
    select: { name: true, email: true },
  });

  return (
    <PrepareEditor
      doc={{
        id: doc.id,
        title: doc.title,
        content: doc.content,
        sourceType: doc.sourceType,
        pdfPath: doc.pdfPath,
      }}
      initialFields={doc.fields.map((f) => ({
        type: f.type as never,
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        slot: f.slot,
        page: f.page,
      }))}
      contacts={contacts}
    />
  );
}
