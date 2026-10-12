import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Dispatch',
  description: 'Weekly newsletter on the Indian startup ecosystem',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=Playfair+Display+SC:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap"
        />
      </head>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
        {children}
      </body>
    </html>
  )
}
