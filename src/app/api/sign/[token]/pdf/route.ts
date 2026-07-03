import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSignedPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const signer = await db.signer.findUnique({ where: { token }, include: { document: true } });
  // The signer only gets their copy once the document is completed.
  if (!signer || !signer.signedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const bytes = await generateSignedPdf(signer.documentId);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${signer.document.title.replace(/[^\w\- ]+/g, '')} - signed.pdf"`,
    },
  });
}
