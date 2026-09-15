import type { Metadata, Viewport } from 'next'
import '../index.css'

export const metadata: Metadata = {
  title: 'عصابة الملاعب — لعبة الخيانة والاستنتاج',
  description: 'لعبة أونلاين تجمع بين كرة القدم والاستنتاج والخيانة.',
}

export const viewport: Viewport = {
  themeColor: '#0a0909',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
