import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSignedPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.document.findFirst({ where: { id, ownerId: user.id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const bytes = await generateSignedPdf(doc.id);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.title.replace(/[^\w\- ]+/g, '')}.pdf"`,
    },
  });
}
