import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'عصابة الملاعب',
  description: 'لعبة تحقيق سرية بين فرق كرة القدم.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
