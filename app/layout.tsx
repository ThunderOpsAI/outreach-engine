import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outreach Engine',
  description: 'AI-powered outreach message generator',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </body>
    </html>
  )
}