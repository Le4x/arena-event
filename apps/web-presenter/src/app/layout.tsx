import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arena Event - Public Screen',
  description: 'Public display for live quiz and blind test events',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
