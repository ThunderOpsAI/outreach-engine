import type { Metadata } from 'next'
import { Providers } from '../components/Providers.js'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outreach Engine',
  description: 'Generate personalized outreach messages',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}