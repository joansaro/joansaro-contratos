'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteDocumentAction, sendReminderAction } from '@/lib/actions';
import { Icon } from '@/components/icons';

export function DetailActions({
  documentId,
  status,
  signLink,
}: {
  documentId: string;
  status: string;
  signLink: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [reminded, setReminded] = useState(false);

  const copyLink = () => {
    if (!signLink) return;
    navigator.clipboard.writeText(`${window.location.origin}${signLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const remind = () => {
    startTransition(async () => {
      const res = await sendReminderAction(documentId);
      if (res.ok) {
        setReminded(true);
        setTimeout(() => setReminded(false), 2000);
      }
    });
  };

  const del = () => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    startTransition(async () => {
      await deleteDocumentAction(documentId);
    });
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      {status === 'DRAFT' && (
        <Link href={`/documents/${documentId}/prepare`} className="jo-btn jo-btn-primary">
          <Icon name="penLine" size={14} /> Prepare & send
        </Link>
      )}
      <a href={`/api/documents/${documentId}/pdf`} className="jo-btn jo-btn-secondary" download>
        <Icon name="download" size={14} /> Download PDF
      </a>
      {signLink && status !== 'DRAFT' && (
        <button type="button" className="jo-btn jo-btn-secondary" onClick={copyLink}>
          <Icon name="copy" size={14} /> {copied ? 'Copied!' : 'Copy signing link'}
        </button>
      )}
      {(status === 'SENT' || status === 'VIEWED') && (
        <button type="button" className="jo-btn jo-btn-secondary" onClick={remind} disabled={pending}>
          <Icon name="bell" size={14} /> {reminded ? 'Reminder logged' : 'Resend reminder'}
        </button>
      )}
      <button type="button" className="jo-btn jo-btn-danger" onClick={del} disabled={pending} aria-label="Delete document">
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}
