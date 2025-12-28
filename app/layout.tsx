import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Medical Appointment Voice Agent',
  description: 'Automated voice agent for confirming patient appointments',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
