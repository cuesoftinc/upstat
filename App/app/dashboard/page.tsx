import styles from '../page.module.css'
import Link from 'next/link'

export default function Home() {
  return (
    <main className={styles.main}>
     <h2>Dashboard goes here</h2>
     <Link href="/">Go to Home</Link>
    </main>
  )
}
