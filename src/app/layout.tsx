import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Joansaro — Contratos',
  description: 'Send, track and sign contracts. Demo system by Joansaro.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Caveat:wght@400;600&family=Dancing+Script:wght@400;600&family=Allura&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
