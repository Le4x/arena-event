import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Arena Event - Plateforme de Quiz & Blind Test en Direct',
  description: 'Organisez des événements interactifs avec des quiz et blind tests en temps réel. Solution professionnelle pour vos soirées quiz et animations.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
