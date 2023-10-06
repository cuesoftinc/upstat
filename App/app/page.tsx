import styles from './page.module.css'
import Link from 'next/link'

export default function Home() {
  return (
    <main className={styles.main}>
     <h2>Home goes here</h2>
     <Link href="/dashboard">Go to dashboard</Link>
    </main>
  )
}
