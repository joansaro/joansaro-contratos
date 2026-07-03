/** Server-friendly primitives implementing the Joansaro design system. */

export function Badge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SENT: 'Sent',
    VIEWED: 'Viewed',
    SIGNED: 'Signed',
    DECLINED: 'Declined',
    EXPIRED: 'Expired',
  };
  return <span className={`jo-badge jo-badge-${status}`}>{labels[status] ?? status}</span>;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: '#F5F5F5',
        color: '#525252',
        font: `500 ${Math.round(size * 0.4)}px var(--jo-font-sans)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <p className="jo-h2" style={{ margin: 0 }}>{title}</p>
      {children && <p className="jo-caption" style={{ margin: 0, maxWidth: 380 }}>{children}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

/** Renders contract content: lines ending in ':' are section titles, blank lines split paragraphs. */
export function ContractBody({ content, compact }: { content: string; compact?: boolean }) {
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const first = lines[0] ?? '';
        const isTitled = first.endsWith(':');
        const title = isTitled ? first.slice(0, -1) : null;
        const body = (isTitled ? lines.slice(1) : lines).join('\n');
        return (
          <div key={i}>
            {title &&
              (i === 0 ? (
                <h1 className="jo-doc-title" style={compact ? { fontSize: 16, lineHeight: '22px', marginBottom: 10 } : undefined}>
                  {title}
                </h1>
              ) : (
                <h2 className="jo-doc-section" style={compact ? { fontSize: 11, lineHeight: '15px' } : undefined}>{title}</h2>
              ))}
            {body && (
              <p className="jo-doc-p" style={compact ? { fontSize: 9, lineHeight: '14px', marginBottom: 6 } : undefined}>
                {body}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Renders a filled/blank field value inside a field box. */
export function FieldContent({ type, value }: { type: string; value: string | null }) {
  if (!value) {
    const labels: Record<string, string> = {
      signature: 'Signature',
      date: 'Date',
      text: 'Text',
      checkbox: '',
    };
    return <span>{labels[type] ?? type}</span>;
  }
  if (type === 'signature') {
    try {
      const sig = JSON.parse(value) as { kind: string; text?: string; font?: string; dataUrl?: string };
      if (sig.kind === 'typed') {
        return (
          <span style={{ fontFamily: sig.font, fontSize: 22, lineHeight: 1, color: '#0A0A0A' }}>
            {sig.text}
          </span>
        );
      }
      if (sig.kind === 'draw' && sig.dataUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={sig.dataUrl} alt="signature" style={{ maxHeight: '90%', maxWidth: '95%', objectFit: 'contain' }} />;
      }
    } catch {
      /* fall through */
    }
  }
  if (type === 'checkbox') return <span style={{ fontSize: 14 }}>✓</span>;
  return <span style={{ color: '#0A0A0A' }}>{value}</span>;
}
