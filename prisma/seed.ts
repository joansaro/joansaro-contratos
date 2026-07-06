/** Seeds a demo account, three templates and sample documents. */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const TPL_WEDDING = `Wedding Photography Agreement:
This agreement is entered into between the Photographer and the Client for professional photography services on the wedding date specified below.

Scope of services:
The Photographer will provide up to ten hours of continuous coverage on the event date, including preparation, ceremony and reception. A curated gallery of fully edited, high-resolution images will be delivered within six weeks of the event.

Payment terms:
A non-refundable retainer of 30% is due upon signing to reserve the date. The remaining balance is due fourteen days before the event. Travel beyond fifty kilometers is billed separately.

Cancellation policy:
If the Client cancels more than ninety days before the event, all payments beyond the retainer will be refunded. Cancellations within ninety days forfeit all payments made.

Image rights:
The Photographer retains copyright and may use selected images for portfolio and promotion. The Client receives a personal-use license for all delivered images.`;

const TPL_NDA = `Mutual Non-Disclosure Agreement:
This Non-Disclosure Agreement is made between the parties identified below to protect confidential information exchanged during their business relationship.

Confidential information:
Each party may disclose business, technical or financial information that is marked or reasonably understood to be confidential. Confidential information excludes information that is public, independently developed, or lawfully received from a third party.

Obligations:
The receiving party will protect confidential information with at least the same care used for its own information, and will not disclose it to third parties without prior written consent.

Term:
This agreement remains in effect for two years from the date of signature. Confidentiality obligations survive termination for three additional years.`;

const TPL_SERVICES = `Event Services Contract:
This contract covers the provision of event decoration and coordination services for the occasion described below.

Services included:
Design proposal, sourcing of decorative materials, on-site setup and teardown, and coordination with the venue during the event window.

Client responsibilities:
The Client will provide venue access at least four hours before the event start and confirm final guest count seven days in advance.

Payment schedule:
Fifty percent is due upon signing; the remainder is due on the event date. Additional requests on the day are billed at the standard hourly rate.

Liability:
The provider carries public liability insurance. Damage caused by guests to rented materials is billed to the Client at replacement cost.`;

async function main() {
  console.log('Seeding contratos…');
  await prisma.event.deleteMany();
  await prisma.field.deleteMany();
  await prisma.signer.deleteMany();
  await prisma.document.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Demo1234!', 10);
  const user = await prisma.user.create({
    data: { name: 'Andrés Santos', email: 'demo@joansaro.dev', passwordHash },
  });

  await prisma.template.createMany({
    data: [
      { ownerId: user.id, title: 'Wedding Photography Agreement', content: TPL_WEDDING },
      { ownerId: user.id, title: 'Mutual NDA', content: TPL_NDA },
      { ownerId: user.id, title: 'Event Services Contract', content: TPL_SERVICES },
    ],
  });

  // Sample documents in different states
  const mkToken = () => randomBytes(24).toString('base64url');

  const signed = await prisma.document.create({
    data: {
      ownerId: user.id,
      title: 'Wedding Photography Agreement',
      content: TPL_WEDDING,
      sourceType: 'template',
      status: 'SIGNED',
      fields: {
        create: [
          {
            type: 'signature', x: 8, y: 78, w: 30, h: 7,
            value: JSON.stringify({ kind: 'typed', text: 'Sarah Johnson', font: 'var(--jo-font-script-2)' }),
          },
          { type: 'date', x: 62, y: 78, w: 22, h: 5, value: new Date().toLocaleDateString('en-US') },
        ],
      },
      signers: {
        create: {
          slot: 1,
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          token: mkToken(),
          sentAt: new Date(Date.now() - 26 * 3600e3),
          viewedAt: new Date(Date.now() - 5 * 3600e3),
          signedAt: new Date(Date.now() - 2 * 3600e3),
        },
      },
      events: {
        create: [
          { type: 'created', detail: 'Document created from template', createdAt: new Date(Date.now() - 27 * 3600e3) },
          { type: 'sent', detail: 'Sent to Sarah Johnson', createdAt: new Date(Date.now() - 26 * 3600e3) },
          { type: 'viewed', detail: 'Sarah Johnson opened the document', createdAt: new Date(Date.now() - 5 * 3600e3) },
          { type: 'signed', detail: 'Sarah Johnson signed the document', createdAt: new Date(Date.now() - 2 * 3600e3) },
        ],
      },
    },
  });

  await prisma.document.create({
    data: {
      ownerId: user.id,
      title: 'Product Photography NDA',
      content: TPL_NDA,
      sourceType: 'template',
      status: 'SENT',
      fields: {
        create: [{ type: 'signature', x: 8, y: 80, w: 30, h: 7 }],
      },
      signers: {
        create: {
          slot: 1,
          name: 'Emma Rodriguez',
          email: 'emma@example.com',
          token: mkToken(),
          sentAt: new Date(Date.now() - 30 * 3600e3),
          viewedAt: new Date(Date.now() - 6 * 3600e3),
        },
      },
      events: {
        create: [
          { type: 'created', detail: 'Document created from template', createdAt: new Date(Date.now() - 31 * 3600e3) },
          { type: 'sent', detail: 'Sent to Emma Rodriguez', createdAt: new Date(Date.now() - 30 * 3600e3) },
          { type: 'viewed', detail: 'Emma Rodriguez opened the document', createdAt: new Date(Date.now() - 6 * 3600e3) },
        ],
      },
    },
  });

  await prisma.document.create({
    data: {
      ownerId: user.id,
      title: 'Birthday Event Services',
      content: TPL_SERVICES,
      sourceType: 'blank',
      status: 'DRAFT',
      events: {
        create: [{ type: 'created', detail: 'Document created', createdAt: new Date(Date.now() - 80 * 3600e3) }],
      },
    },
  });

  console.log('Seed listo. Login: demo@joansaro.dev / Demo1234!');
  console.log('Docs:', (await prisma.document.count()), '· Templates:', (await prisma.template.count()));
  void signed;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
