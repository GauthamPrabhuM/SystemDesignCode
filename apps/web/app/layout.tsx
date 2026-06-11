import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'SystemDesignCode — machine coding & LLD interview practice',
    template: '%s · SystemDesignCode',
  },
  description: 'Machine coding, low-level design, and backend interview practice — built for serious engineers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
