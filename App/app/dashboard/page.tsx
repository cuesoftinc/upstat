import styles from '../page.module.css'
import Link from 'next/link'

export default function Home() {
  return (
    <section>
     <h2>Dashboard goes here</h2>
     <Link href="/">Go to Home</Link>
    </section>
  )
}
