'use server';

import { createHash, randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';

import { db } from './db';
import { extractTemplateVars } from './template-vars';
import { createSession, destroySession, requireUser } from './auth';
import { mail } from './mail';

// ============================== AUTH ==============================

export interface FormState {
  error?: string;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: 'Invalid email or password.' };
  }
  await createSession(user.id);
  redirect('/dashboard');
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (name.length < 2) return { error: 'Enter your name.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { error: 'An account with that email already exists.' };
  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
  });
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

// ============================== DOCUMENTS ==============================

const mkToken = () => randomBytes(24).toString('base64url');

/** Best-effort request evidence for the audit trail. */
async function requestEvidence() {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    '127.0.0.1';
  const ua = h.get('user-agent') ?? 'unknown';
  return { ip, ua: ua.slice(0, 300) };
}

export async function createBlankDocumentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim() || 'Untitled contract';
  const content = String(formData.get('content') ?? '').trim();
  const doc = await db.document.create({
    data: {
      ownerId: user.id,
      title,
      content: content || `${title}:\nWrite the contract terms here.`,
      sourceType: 'blank',
      events: { create: { type: 'created', detail: 'Document created' } },
    },
  });
  redirect(`/documents/${doc.id}/prepare`);
}

/** Crea un documento desde plantilla rellenando variables {{x}} desde el form. */
export async function createFromTemplateWithVarsAction(
  templateId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const tpl = await db.template.findFirst({
    where: { id: templateId, OR: [{ ownerId: user.id }, { ownerId: null }] },
  });
  if (!tpl) redirect('/templates');

  let content = tpl.content;
  for (const name of extractTemplateVars(tpl.content)) {
    const value = String(formData.get(`var:${name}`) ?? '').trim() || `{{${name}}}`;
    content = content.replaceAll(new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g'), value);
  }

  const doc = await db.document.create({
    data: {
      ownerId: user.id,
      title: String(formData.get('title') ?? '').trim().slice(0, 160) || tpl.title,
      content,
      sourceType: 'template',
      events: { create: [{ type: 'created', detail: `Created from template \u201C${tpl.title}\u201D` }] },
    },
  });
  redirect(`/documents/${doc.id}/prepare`);
}

export async function createFromTemplateAction(templateId: string): Promise<void> {
  const user = await requireUser();
  const tpl = await db.template.findUnique({ where: { id: templateId } });
  if (!tpl) throw new Error('Template not found');
  const doc = await db.document.create({
    data: {
      ownerId: user.id,
      title: tpl.title,
      content: tpl.content,
      sourceType: 'template',
      events: { create: { type: 'created', detail: `Created from template “${tpl.title}”` } },
    },
  });
  redirect(`/documents/${doc.id}/prepare`);
}

export async function createFromPdfAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const file = formData.get('pdf') as File | null;
  if (!file || file.size === 0) throw new Error('No file');
  if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported');
  if (file.size > 10 * 1024 * 1024) throw new Error('Max 10 MB');

  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}.pdf`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const title = file.name.replace(/\.pdf$/i, '') || 'Uploaded contract';
  const doc = await db.document.create({
    data: {
      ownerId: user.id,
      title,
      content: '',
      sourceType: 'pdf',
      pdfPath: `/uploads/${filename}`,
      events: { create: { type: 'created', detail: `PDF “${file.name}” uploaded` } },
    },
  });
  redirect(`/documents/${doc.id}/prepare`);
}

export async function deleteDocumentAction(id: string): Promise<void> {
  const user = await requireUser();
  await db.document.deleteMany({ where: { id, ownerId: user.id } });
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

// ---------- Prepare: save field layout ----------

const FieldSchema = z.object({
  type: z.enum(['signature', 'date', 'text', 'checkbox']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  slot: z.number().int().min(1).max(5).default(1),
  page: z.number().int().min(1).max(50).default(1),
});

export async function saveFieldsAction(
  documentId: string,
  fields: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: user.id } });
  if (!doc) return { ok: false, error: 'Document not found' };
  if (doc.status !== 'DRAFT') return { ok: false, error: 'Only drafts can be edited' };

  const parsed = z.array(FieldSchema).max(40).safeParse(fields);
  if (!parsed.success) return { ok: false, error: 'Invalid fields' };

  await db.$transaction([
    db.field.deleteMany({ where: { documentId } }),
    db.field.createMany({ data: parsed.data.map((f) => ({ ...f, documentId })) }),
  ]);
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

// ---------- Edit content (drafts only) ----------

export async function updateContentAction(
  documentId: string,
  title: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: user.id } });
  if (!doc) return { ok: false, error: 'Document not found' };
  if (doc.status !== 'DRAFT') return { ok: false, error: 'Only drafts can be edited' };
  if (doc.sourceType === 'pdf') return { ok: false, error: 'PDF documents cannot be edited' };
  const cleanTitle = title.trim().slice(0, 160) || doc.title;
  await db.document.update({
    where: { id: documentId },
    data: { title: cleanTitle, content: content.trim().slice(0, 20000) },
  });
  return { ok: true };
}

// ---------- Send for signature ----------

const SIGNING_ORDERS = new Set(['sequential', 'parallel']);

export async function sendForSignatureAction(
  documentId: string,
  _prev: FormState & { links?: { name: string; link: string }[] },
  formData: FormData,
): Promise<FormState & { links?: { name: string; link: string }[] }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { fields: true },
  });
  if (!doc) return { error: 'Document not found' };
  if (doc.status !== 'DRAFT') return { error: 'This document was already sent.' };
  if (doc.fields.length === 0) return { error: 'Place at least one field before sending.' };

  // Firmantes: filas paralelas name[]/email[] en orden = slot 1..N
  const names = formData.getAll('signerName').map((v) => String(v).trim());
  const emails = formData.getAll('signerEmail').map((v) => String(v).trim().toLowerCase());
  const signers = names
    .map((name, i) => ({ name, email: emails[i] ?? '', slot: i + 1 }))
    .filter((sg) => sg.name || sg.email);
  if (signers.length === 0) return { error: 'Add at least one signer.' };
  if (signers.length > 5) return { error: 'Up to 5 signers per document.' };
  for (const sg of signers) {
    if (sg.name.length < 2) return { error: `Enter a name for signer ${sg.slot}.` };
    if (!/^\S+@\S+\.\S+$/.test(sg.email)) return { error: `Enter a valid email for signer ${sg.slot}.` };
  }
  if (new Set(signers.map((sg) => sg.email)).size !== signers.length) {
    return { error: 'Each signer needs a different email.' };
  }

  // Los campos deben apuntar a slots existentes
  const maxSlot = signers.length;
  if (doc.fields.some((f) => f.slot > maxSlot)) {
    return { error: `Some fields are assigned to signer ${Math.max(...doc.fields.map((f) => f.slot))}, but you only added ${maxSlot}.` };
  }

  const signingOrder = SIGNING_ORDERS.has(String(formData.get('signingOrder')))
    ? String(formData.get('signingOrder'))
    : 'sequential';
  const message = String(formData.get('message') ?? '').trim();
  const expiresDays = Math.min(Math.max(Number(formData.get('expiresDays') ?? 30) || 30, 1), 365);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 3600e3);

  const contentHash = createHash('sha256')
    .update(doc.sourceType === 'pdf' ? doc.pdfPath ?? '' : doc.content)
    .digest('hex');

  const created = await db.$transaction(async (tx) => {
    await tx.signer.deleteMany({ where: { documentId } });
    const rows = [];
    for (const sg of signers) {
      rows.push(
        await tx.signer.create({
          data: {
            documentId,
            slot: sg.slot,
            name: sg.name,
            email: sg.email,
            token: mkToken(),
            message: message || null,
            sentAt: new Date(),
          },
        }),
      );
    }
    await tx.document.update({
      where: { id: documentId },
      data: { status: 'SENT', signingOrder, expiresAt, contentHash },
    });
    await tx.event.create({
      data: {
        documentId,
        type: 'sent',
        detail: `Sent to ${signers.map((sg) => sg.name).join(', ')} (${signingOrder}, expires in ${expiresDays}d)`,
      },
    });
    // Directorio de contactos: upsert por email
    for (const sg of signers) {
      await tx.contact.upsert({
        where: { ownerId_email: { ownerId: user.id, email: sg.email } },
        create: { ownerId: user.id, name: sg.name, email: sg.email },
        update: { name: sg.name },
      });
    }
    return rows;
  });

  // Invitaciones: secuencial → solo slot 1; paralelo → todos
  const toInvite = signingOrder === 'sequential' ? created.filter((sg) => sg.slot === 1) : created;
  for (const sg of toInvite) {
    await mail.invite(sg.email, sg.name, doc.title, user.name, sg.token, message || null);
  }

  return { links: created.map((sg) => ({ name: sg.name, link: `/sign/${sg.token}` })) };
}

export async function sendReminderAction(documentId: string, signerId?: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { signers: true },
  });
  if (!doc) return { ok: false };
  const pending = doc.signers.filter((sg) => !sg.signedAt && !sg.declinedAt);
  const targets = signerId ? pending.filter((sg) => sg.id === signerId) : pending;
  if (targets.length === 0) return { ok: false };
  for (const sg of targets) {
    await mail.reminder(sg.email, sg.name, doc.title, user.name, sg.token);
    await db.event.create({
      data: { documentId, type: 'reminder', detail: `Reminder emailed to ${sg.name}` },
    });
  }
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

// ---------- Lifecycle: void, duplicate, resend ----------

const OPEN_STATUSES = ['SENT', 'PARTIALLY_SIGNED'];

export async function voidDocumentAction(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { signers: true },
  });
  if (!doc) return { ok: false, error: 'Not found' };
  if (!OPEN_STATUSES.includes(doc.status)) return { ok: false, error: 'Only in-progress documents can be voided.' };

  await db.$transaction([
    db.document.update({ where: { id: documentId }, data: { status: 'VOIDED' } }),
    db.event.create({ data: { documentId, type: 'voided', detail: `Voided by ${user.name}` } }),
  ]);
  for (const sg of doc.signers.filter((x) => !x.signedAt && !x.declinedAt)) {
    await mail.voided(sg.email, sg.name, doc.title, user.name);
  }
  revalidatePath(`/documents/${documentId}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function duplicateDocumentAction(documentId: string): Promise<void> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { fields: true },
  });
  if (!doc) redirect('/dashboard');
  const copy = await db.document.create({
    data: {
      ownerId: user.id,
      title: `${doc.title} (copy)`,
      content: doc.content,
      sourceType: doc.sourceType,
      pdfPath: doc.pdfPath,
      status: 'DRAFT',
      fields: {
        create: doc.fields.map((f) => ({
          type: f.type, x: f.x, y: f.y, w: f.w, h: f.h,
          required: f.required, slot: f.slot, page: f.page,
        })),
      },
      events: { create: [{ type: 'created', detail: `Duplicated from "${doc.title}"` }] },
    },
  });
  redirect(`/documents/${copy.id}`);
}

/** Regenera el token de un firmante pendiente (link viejo muere) y reenvía la invitación. */
export async function resendLinkAction(documentId: string, signerId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { signers: true },
  });
  if (!doc) return { ok: false, error: 'Not found' };
  const signer = doc.signers.find((sg) => sg.id === signerId);
  if (!signer || signer.signedAt) return { ok: false, error: 'This signer already signed.' };

  const token = mkToken();
  await db.$transaction([
    db.signer.update({
      where: { id: signerId },
      data: { token, sentAt: new Date(), declinedAt: null, declineNote: null },
    }),
    db.event.create({
      data: { documentId, type: 'sent', detail: `New signing link issued for ${signer.name}` },
    }),
  ]);
  await mail.invite(signer.email, signer.name, doc.title, user.name, token, signer.message);
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

/** Marca EXPIRED (lazy) los documentos abiertos vencidos; devuelve el estado real. */
export async function ensureNotExpired(doc: { id: string; status: string; expiresAt: Date | null }): Promise<string> {
  if (OPEN_STATUSES.includes(doc.status) && doc.expiresAt && doc.expiresAt < new Date()) {
    await db.$transaction([
      db.document.update({ where: { id: doc.id }, data: { status: 'EXPIRED' } }),
      db.event.create({ data: { documentId: doc.id, type: 'expired', detail: 'Signing window expired' } }),
    ]);
    return 'EXPIRED';
  }
  return doc.status;
}

// ============================== SIGNER (public, by token) ==============================// ============================== SIGNER (public, by token) ==============================

export async function markViewedAction(token: string): Promise<void> {
  const signer = await db.signer.findUnique({ where: { token } });
  if (!signer || signer.viewedAt || signer.signedAt || signer.declinedAt) return;
  const { ip, ua } = await requestEvidence();
  await db.$transaction([
    db.signer.update({ where: { id: signer.id }, data: { viewedAt: new Date(), viewedIp: ip, viewedUa: ua } }),
    db.event.create({
      data: { documentId: signer.documentId, type: 'viewed', detail: `${signer.name} opened the document` },
    }),
  ]);
  revalidatePath('/dashboard');
}

const SubmitSchema = z.record(z.string(), z.string().max(20000));

export async function submitSignatureAction(
  token: string,
  values: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const signer = await db.signer.findUnique({
    where: { token },
    include: {
      document: { include: { fields: true, signers: true, owner: { select: { name: true, email: true } } } },
    },
  });
  if (!signer) return { ok: false, error: 'Invalid link' };
  if (signer.signedAt) return { ok: false, error: 'Already signed' };
  if (signer.declinedAt) return { ok: false, error: 'This document was declined' };

  const doc = signer.document;
  const status = await ensureNotExpired(doc);
  if (status === 'EXPIRED') return { ok: false, error: 'This signing link has expired.' };
  if (!['SENT', 'PARTIALLY_SIGNED'].includes(status)) {
    return { ok: false, error: 'This document is no longer open for signing.' };
  }

  // Turno secuencial: solo puede firmar el slot activo (el menor sin firmar)
  if (doc.signingOrder === 'sequential') {
    const activeSlot = Math.min(
      ...doc.signers.filter((sg) => !sg.signedAt && !sg.declinedAt).map((sg) => sg.slot),
    );
    if (signer.slot !== activeSlot) {
      return { ok: false, error: 'It is not your turn to sign yet.' };
    }
  }

  const parsed = SubmitSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: 'Invalid submission' };

  // Solo los campos de SU slot
  const myFields = doc.fields.filter((f) => f.slot === signer.slot);
  for (const f of myFields.filter((f) => f.required)) {
    if (!parsed.data[f.id]) return { ok: false, error: 'Complete all required fields.' };
  }

  const others = doc.signers.filter((sg) => sg.id !== signer.id);
  const allSigned = others.every((sg) => sg.signedAt) /* los demás */;
  const nextStatus = allSigned ? 'SIGNED' : 'PARTIALLY_SIGNED';

  const { ip, ua } = await requestEvidence();
  await db.$transaction([
    ...myFields
      .filter((f) => parsed.data[f.id] !== undefined)
      .map((f) => db.field.update({ where: { id: f.id }, data: { value: parsed.data[f.id] } })),
    db.signer.update({ where: { id: signer.id }, data: { signedAt: new Date(), signedIp: ip, signedUa: ua } }),
    db.document.update({ where: { id: doc.id }, data: { status: nextStatus } }),
    db.event.create({
      data: { documentId: doc.id, type: 'signed', detail: `${signer.name} signed (${signer.slot}/${doc.signers.length})` },
    }),
  ]);

  if (allSigned) {
    // Documento completo: avisar a dueño y a todos los firmantes
    await mail.completed(doc.owner.email, doc.title, doc.id);
    for (const sg of doc.signers) {
      await mail.completed(sg.email, doc.title, doc.id);
    }
    await db.event.create({ data: { documentId: doc.id, type: 'completed', detail: 'All parties signed' } });
  } else if (doc.signingOrder === 'sequential') {
    // Invitar al siguiente en el orden
    const remaining = others.filter((sg) => !sg.signedAt && !sg.declinedAt);
    if (remaining.length > 0) {
      const next = remaining.reduce((a, b) => (a.slot < b.slot ? a : b));
      await mail.invite(next.email, next.name, doc.title, doc.owner.name, next.token, next.message);
      await db.event.create({
        data: { documentId: doc.id, type: 'sent', detail: `Invitation sent to next signer: ${next.name}` },
      });
    }
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function declineAction(token: string, note: string): Promise<{ ok: boolean }> {
  const signer = await db.signer.findUnique({
    where: { token },
    include: { document: { include: { owner: { select: { email: true } } } } },
  });
  if (!signer || signer.signedAt || signer.declinedAt) return { ok: false };
  await db.$transaction([
    db.signer.update({
      where: { id: signer.id },
      data: { declinedAt: new Date(), declineNote: note.slice(0, 500) || null },
    }),
    db.document.update({ where: { id: signer.documentId }, data: { status: 'DECLINED' } }),
    db.event.create({
      data: {
        documentId: signer.documentId,
        type: 'declined',
        detail: `${signer.name} declined${note ? ` — \u201C${note.slice(0, 120)}\u201D` : ''}`,
      },
    }),
  ]);
  await mail.declined(signer.document.owner.email, signer.document.title, signer.name, note || null);
  revalidatePath('/dashboard');
  return { ok: true };
}

// ============================== CONTACTS ==============================

export async function upsertContactAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState & { ok?: boolean }> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const notes = String(formData.get('notes') ?? '').trim();
  if (name.length < 2) return { error: 'Enter a name.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' };

  if (id) {
    await db.contact.updateMany({
      where: { id, ownerId: user.id },
      data: { name, email, notes: notes || null },
    });
  } else {
    const exists = await db.contact.findUnique({
      where: { ownerId_email: { ownerId: user.id, email } },
    });
    if (exists) return { error: 'You already have a contact with that email.' };
    await db.contact.create({ data: { ownerId: user.id, name, email, notes: notes || null } });
  }
  revalidatePath('/clients');
  return { ok: true };
}

export async function deleteContactAction(id: string): Promise<void> {
  const user = await requireUser();
  await db.contact.deleteMany({ where: { id, ownerId: user.id } });
  revalidatePath('/clients');
}

// ============================== TEMPLATES ==============================// ============================== TEMPLATES ==============================

export async function createTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  if (title.length < 2) return { error: 'Enter a template title.' };
  if (content.length < 10) return { error: 'Write the template content.' };
  await db.template.create({ data: { ownerId: user.id, title: title.slice(0, 160), content: content.slice(0, 20000) } });
  revalidatePath('/templates');
  redirect('/templates');
}

export async function updateTemplateAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  if (title.length < 2) return { error: 'Enter a template title.' };
  if (content.length < 10) return { error: 'Write the template content.' };
  await db.template.update({ where: { id }, data: { title: title.slice(0, 160), content: content.slice(0, 20000) } });
  revalidatePath('/templates');
  redirect('/templates');
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await requireUser();
  await db.template.delete({ where: { id } });
  revalidatePath('/templates');
}
