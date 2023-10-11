import styles from './page.module.css'
import Link from 'next/link'


export default function Home() {
  return (
    <section className="dummy-classname">
      <h2>Dashboard goes here</h2>
      <Link href="/dashboard">Go to dashboard</Link>
    </section>
  )
}
