import styles from './page.module.css'
import { HomeContainer } from "./app.style"
import Link from 'next/link'

export default function Home() {
  return (
    <main className={styles.main}>
      <HomeContainer>
        <h2>Home goes here</h2>
        <Link href="/dashboard">Go to dashboard</Link>
      </HomeContainer>
    </main>
  )
}
