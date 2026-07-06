'use client';

/** CRUD de contactos: alta con botón, edición y borrado en línea. */
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteContactAction, upsertContactAction, type FormState } from '@/lib/actions';
import { Icon } from '@/components/icons';

interface ContactInfo {
  id: string;
  name: string;
  email: string;
  notes: string | null;
}

export function NewContactButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="jo-btn jo-btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> New contact
      </button>
      {open && <ContactModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function ContactActions({ contact }: { contact: ContactInfo }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const del = () => {
    if (!window.confirm(`Delete ${contact.name} from your contacts? Their documents are kept.`)) return;
    startTransition(async () => {
      await deleteContactAction(contact.id);
      router.refresh();
    });
  };

  return (
    <>
      <div style={{ display: 'inline-flex', gap: 6 }}>
        <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={del} disabled={pending} style={{ color: 'var(--jo-danger)' }}>
          Delete
        </button>
      </div>
      {editing && <ContactModal contact={contact} onClose={() => setEditing(false)} />}
    </>
  );
}

function ContactModal({ contact, onClose }: { contact?: ContactInfo; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState & { ok?: boolean }, FormData>(
    upsertContactAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="jo-overlay" onClick={onClose}>
      <div className="jo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--jo-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="jo-h2">{contact ? `Edit ${contact.name}` : 'New contact'}</span>
          <button type="button" className="jo-btn jo-btn-ghost jo-btn-sm" onClick={onClose} aria-label="Close" style={{ padding: '0 8px' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <form action={formAction} style={{ padding: 24, display: 'grid', gap: 14 }}>
          {state.error && (
            <div style={{ padding: '10px 12px', borderRadius: 6, background: '#FEF2F2', color: 'var(--jo-danger)', font: '400 13px var(--jo-font-sans)' }}>
              {state.error}
            </div>
          )}
          {contact && <input type="hidden" name="id" value={contact.id} />}
          <div>
            <label className="jo-label" htmlFor="c-name">Name</label>
            <input id="c-name" name="name" className="jo-input" defaultValue={contact?.name} required />
          </div>
          <div>
            <label className="jo-label" htmlFor="c-email">Email</label>
            <input id="c-email" name="email" type="email" className="jo-input" defaultValue={contact?.email} required />
          </div>
          <div>
            <label className="jo-label" htmlFor="c-notes">Notes (optional)</label>
            <input id="c-notes" name="notes" className="jo-input" defaultValue={contact?.notes ?? ''} placeholder="e.g. Prefers Spanish contracts" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="jo-btn jo-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="jo-btn jo-btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
