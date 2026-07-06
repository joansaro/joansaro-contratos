'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  deleteDocumentAction,
  duplicateDocumentAction,
  resendLinkAction,
  sendReminderAction,
  voidDocumentAction,
} from '@/lib/actions';
import { Icon } from '@/components/icons';

// ============================== HEADER ACTIONS ==============================

export function DetailActions({ documentId, status }: { documentId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  const open = status === 'SENT' || status === 'PARTIALLY_SIGNED';

  const voidDoc = () => {
    if (!window.confirm('Void this document? Pending signing links will stop working and signers will be notified.')) return;
    startTransition(async () => {
      await voidDocumentAction(documentId);
    });
  };

  const duplicate = () => {
    startTransition(async () => {
      await duplicateDocumentAction(documentId);
    });
  };

  const del = () => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    startTransition(async () => {
      await deleteDocumentAction(documentId);
    });
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {status === 'DRAFT' && (
        <Link href={`/documents/${documentId}/prepare`} className="jo-btn jo-btn-primary">
          <Icon name="penLine" size={14} /> Prepare & send
        </Link>
      )}
      <a href={`/api/documents/${documentId}/pdf`} className="jo-btn jo-btn-secondary" download>
        <Icon name="download" size={14} /> Download PDF
      </a>
      <button type="button" className="jo-btn jo-btn-secondary" onClick={duplicate} disabled={pending}>
        <Icon name="copy" size={14} /> Duplicate
      </button>
      {open && (
        <button type="button" className="jo-btn jo-btn-secondary" onClick={voidDoc} disabled={pending}>
          <Icon name="x" size={14} /> Void
        </button>
      )}
      <button type="button" className="jo-btn jo-btn-danger" onClick={del} disabled={pending} aria-label="Delete document">
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

// ============================== SIGNER ROW ==============================

export interface SignerInfo {
  id: string;
  slot: number;
  name: string;
  email: string;
  token: string;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  declineNote: string | null;
}

export function SignerRow({
  documentId,
  signer,
  isActiveTurn,
  docOpen,
}: {
  documentId: string;
  signer: SignerInfo;
  isActiveTurn: boolean;
  docOpen: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const state = signer.signedAt
    ? { label: 'Signed', color: 'var(--jo-success)' }
    : signer.declinedAt
      ? { label: 'Declined', color: 'var(--jo-danger)' }
      : signer.viewedAt
        ? { label: 'Viewed', color: 'var(--jo-accent)' }
        : { label: 'Pending', color: 'var(--jo-fg-tertiary)' };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/sign/${signer.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const remind = () => {
    startTransition(async () => {
      const res = await sendReminderAction(documentId, signer.id);
      setFlash(res.ok ? 'Reminder emailed' : 'Could not send');
      setTimeout(() => setFlash(null), 2000);
    });
  };

  const resend = () => {
    startTransition(async () => {
      const res = await resendLinkAction(documentId, signer.id);
      setFlash(res.ok ? 'New link emailed' : (res.error ?? 'Could not resend'));
      setTimeout(() => setFlash(null), 2500);
    });
  };

  return (
    <div style={{ borderLeft: `3px solid ${state.color}`, paddingLeft: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ font: '600 13px var(--jo-font-sans)' }}>
          {signer.slot}. {signer.name}
        </span>
        <span style={{ font: '500 11px var(--jo-font-sans)', color: state.color }}>{state.label}</span>
        {isActiveTurn && !signer.signedAt && (
          <span className="jo-caption" style={{ color: 'var(--jo-accent)' }}>← their turn</span>
        )}
      </div>
      <div className="jo-caption">{signer.email}</div>
      {signer.signedAt && (
        <div className="jo-caption" style={{ color: 'var(--jo-fg-tertiary)' }}>
          signed {new Date(signer.signedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      )}
      {signer.declineNote && (
        <div className="jo-caption" style={{ color: 'var(--jo-danger)' }}>“{signer.declineNote}”</div>
      )}

      {!signer.signedAt && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={copyLink}>
            <Icon name="copy" size={12} /> {copied ? 'Copied!' : 'Copy link'}
          </button>
          {docOpen && !signer.declinedAt && (
            <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={remind} disabled={pending}>
              <Icon name="bell" size={12} /> Remind
            </button>
          )}
          {docOpen && (
            <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={resend} disabled={pending}>
              <Icon name="send" size={12} /> New link
            </button>
          )}
          {flash && <span className="jo-caption" style={{ alignSelf: 'center' }}>{flash}</span>}
        </div>
      )}
    </div>
  );
}
