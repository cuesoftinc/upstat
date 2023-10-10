import Header from '@/components/otherComponents/Header/Header'
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/otherComponents/Footer/Footer'
import Head from 'next/head';
import MenuBar from '@/components/otherComponents/MenuBar/MenuBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Upstat',
  description: 'The Upstat Project',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <Head>
        {/* Set the viewport meta tag */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <body>
        <MenuBar />
        <div>
          <Header />
          {children}
        </div>
      </body>
    </html>
  )
}
