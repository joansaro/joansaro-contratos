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
import { createSession, destroySession, requireUser } from './auth';

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

export async function sendForSignatureAction(
  documentId: string,
  _prev: FormState & { link?: string },
  formData: FormData,
): Promise<FormState & { link?: string }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { fields: true, signer: true },
  });
  if (!doc) return { error: 'Document not found' };
  if (doc.fields.length === 0) return { error: 'Place at least one field before sending.' };

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const message = String(formData.get('message') ?? '').trim();
  if (name.length < 2) return { error: 'Enter the signer’s name.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' };

  const token = doc.signer?.token ?? mkToken();
  const contentHash = createHash('sha256')
    .update(doc.sourceType === 'pdf' ? doc.pdfPath ?? '' : doc.content)
    .digest('hex');
  await db.$transaction([
    db.signer.upsert({
      where: { documentId },
      create: { documentId, name, email, token, message: message || null, sentAt: new Date() },
      update: { name, email, message: message || null, sentAt: new Date() },
    }),
    db.document.update({ where: { id: documentId }, data: { status: 'SENT', contentHash } }),
    db.event.create({
      data: { documentId, type: 'sent', detail: `Sent to ${name} (${email})` },
    }),
  ]);
  // Note: detail and dashboard pages are force-dynamic, so no revalidation is
  // needed here — and revalidating /documents/[id] would also re-render the
  // /prepare child route, which redirects away and would unmount the modal.
  return { link: `/sign/${token}` };
}

export async function sendReminderAction(documentId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id: documentId, ownerId: user.id },
    include: { signer: true },
  });
  if (!doc?.signer) return { ok: false };
  await db.event.create({
    data: { documentId, type: 'reminder', detail: `Reminder sent to ${doc.signer.name}` },
  });
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

// ============================== SIGNER (public, by token) ==============================

export async function markViewedAction(token: string): Promise<void> {
  const signer = await db.signer.findUnique({ where: { token }, include: { document: true } });
  if (!signer || signer.viewedAt || signer.signedAt || signer.declinedAt) return;
  const { ip, ua } = await requestEvidence();
  await db.$transaction([
    db.signer.update({ where: { id: signer.id }, data: { viewedAt: new Date(), viewedIp: ip, viewedUa: ua } }),
    db.document.update({ where: { id: signer.documentId }, data: { status: 'VIEWED' } }),
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
    include: { document: { include: { fields: true } } },
  });
  if (!signer) return { ok: false, error: 'Invalid link' };
  if (signer.signedAt) return { ok: false, error: 'Already signed' };
  if (signer.declinedAt) return { ok: false, error: 'This document was declined' };

  const parsed = SubmitSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: 'Invalid submission' };

  const required = signer.document.fields.filter((f) => f.required);
  for (const f of required) {
    if (!parsed.data[f.id]) return { ok: false, error: 'Complete all required fields.' };
  }

  const { ip, ua } = await requestEvidence();
  await db.$transaction([
    ...signer.document.fields
      .filter((f) => parsed.data[f.id] !== undefined)
      .map((f) => db.field.update({ where: { id: f.id }, data: { value: parsed.data[f.id] } })),
    db.signer.update({ where: { id: signer.id }, data: { signedAt: new Date(), signedIp: ip, signedUa: ua } }),
    db.document.update({ where: { id: signer.documentId }, data: { status: 'SIGNED' } }),
    db.event.create({
      data: { documentId: signer.documentId, type: 'signed', detail: `${signer.name} signed the document` },
    }),
  ]);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function declineAction(token: string, note: string): Promise<{ ok: boolean }> {
  const signer = await db.signer.findUnique({ where: { token } });
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
        detail: `${signer.name} declined${note ? ` — “${note.slice(0, 120)}”` : ''}`,
      },
    }),
  ]);
  revalidatePath('/dashboard');
  return { ok: true };
}

// ============================== TEMPLATES ==============================

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
