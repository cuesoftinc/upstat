import Header from '@/components/layout/Header/Header'
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
// import Footer from '@/components/layout/Footer/Footer'
import Head from 'next/head';
import MenuBar from '@/components/layout/MenuBar/MenuBar'
import StyledComponentsRegistry from '@/libs/registry';

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
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <StyledComponentsRegistry>
          <main>
            <MenuBar />
            <div className='content'>
              <Header />
              {children}
            </div>
          </main>
        </StyledComponentsRegistry>
      </body>
    </html>
  )
}
