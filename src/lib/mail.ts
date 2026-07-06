// Mailer demo: los emails se persisten en la bandeja de salida (OutboxEmail)
// y se loguean en consola. Cablear SMTP real = reemplazar `send()`.
import { db } from './db';

async function send(to: string, subject: string, body: string) {
  await db.outboxEmail.create({ data: { to, subject, body } });
  console.log(`📧 [${to}] ${subject}`);
}

const appUrl = () => process.env.APP_URL ?? 'http://localhost:3010';

export const mail = {
  /** Invitación a firmar (por firmante). */
  invite(to: string, signerName: string, docTitle: string, senderName: string, token: string, message?: string | null) {
    return send(
      to,
      `${senderName} sent you "${docTitle}" to sign`,
      `Hi ${signerName},\n\n${senderName} is requesting your signature on "${docTitle}".${message ? `\n\nMessage:\n"${message}"` : ''}\n\nSign here:\n${appUrl()}/sign/${token}\n\nThis link is personal — don't forward it.`,
    );
  },

  reminder(to: string, signerName: string, docTitle: string, senderName: string, token: string) {
    return send(
      to,
      `Reminder: "${docTitle}" is waiting for your signature`,
      `Hi ${signerName},\n\nFriendly reminder from ${senderName}: "${docTitle}" still needs your signature.\n\nSign here:\n${appUrl()}/sign/${token}`,
    );
  },

  /** Todas las partes firmaron: aviso a dueño y firmantes. */
  completed(to: string, docTitle: string, documentId: string) {
    return send(
      to,
      `"${docTitle}" is fully signed ✓`,
      `Good news — every party has signed "${docTitle}".\n\nVerify its integrity anytime:\n${appUrl()}/verify/${documentId}`,
    );
  },

  declined(to: string, docTitle: string, signerName: string, note?: string | null) {
    return send(
      to,
      `"${docTitle}" was declined`,
      `${signerName} declined to sign "${docTitle}".${note ? `\n\nReason:\n"${note}"` : ''}`,
    );
  },

  voided(to: string, signerName: string, docTitle: string, senderName: string) {
    return send(
      to,
      `"${docTitle}" was voided`,
      `Hi ${signerName},\n\n${senderName} has voided "${docTitle}". The signing link no longer works — no action is needed.`,
    );
  },
};
